import {acquireProcessLock} from '../server/lock.js';
import fs from 'node:fs';
import {encodeFunctionData,encodePacked,keccak256,toHex,type Hex} from 'viem';
import {artifact,deployment,local,publicClient,wallet} from '../server/config.js';
import {state,save,event,publicJob,type Job} from '../server/store.js';
import {propose} from '../server/proposal.js';
import {authorize,runJob,exportEvidence} from '../server/agent.js';
import {observe,requestHash} from '../server/provider.js';
acquireProcessLock('chain smoke');
const dep=deployment(),abi=artifact('FactMarket').abi,client=wallet('deployer');
const read=async(id:string)=>await publicClient.readContract({address:dep.market,abi,functionName:'getMarket',args:[BigInt(id)]}) as any;
const output='docs/evidence/chain-smoke.json';
let results:any=fs.existsSync(output)?JSON.parse(fs.readFileSync(output,'utf8')):{network:'Base Sepolia',chainId:84532,contract:dep.market,cases:[]};
const persist=()=>fs.writeFileSync(output,JSON.stringify(results,(_,v)=>typeof v==='bigint'?v.toString():v,2)+'\n');
// Settle exact tamper bytes directly, bypassing the app's off-chain provider checks.
async function reject(job:Job,name:string,args:any[],functionName='settle'){
 const prior=results.cases.find((x:any)=>x.name===name);if(prior?.status==='PASS')return;
 const before=await read(job.marketId!);
 const rejectionClient=name==='duplicate-intent'?wallet('buyer'):client;
 const rejectionRole=name==='duplicate-intent'?'buyer':'deployer';
 const expected:any={'edited-value':'NotSignedByAirnode','stale-real-response':'ResponseTooOld','different-request':'NotSignedByAirnode','wrong-signer':'NotSignedByAirnode','duplicate-intent':'DuplicateIntent'};
 const block=await publicClient.getBlock();
 if(name!=='duplicate-intent'&&(Number(before.state)!==0||block.timestamp<before.observationStart||block.timestamp>before.observationEnd))throw Error('Oracle tamper test requires an open observation window');
 let actualError='';try{await publicClient.simulateContract({account:rejectionClient.account,address:dep.market,abi,functionName,args});}catch(e:any){actualError=e.walk?.((e:any)=>e.name==='ContractFunctionRevertedError')?.data?.errorName||'';}
 if(actualError!==expected[name])throw Error(`Expected ${expected[name]} but got ${actualError}; refusing misleading tamper PASS`);
 const label=`tamper:${name}`;let tx=job.transactions.find(t=>t.label===label);
 if(!tx){const data=encodeFunctionData({abi,functionName,args});const fees=await publicClient.estimateFeesPerGas();const prepared=await rejectionClient.prepareTransactionRequest({account:rejectionClient.account,to:dep.market,data,gas:500000n,maxFeePerGas:fees.maxFeePerGas,maxPriorityFeePerGas:fees.maxPriorityFeePerGas});const raw=await rejectionClient.signTransaction(prepared);const hash=keccak256(raw);tx={label,role:rejectionRole,hash,raw,status:'submitted',url:`https://sepolia.basescan.org/tx/${hash}`};job.transactions.push(tx);save();}
 let receipt;try{receipt=await publicClient.getTransactionReceipt({hash:tx.hash});}catch{}
 if(!receipt){try{await publicClient.sendRawTransaction({serializedTransaction:tx.raw!});}catch(e:any){if(!/already known|nonce too low/i.test(e.message))throw e;}receipt=await publicClient.waitForTransactionReceipt({hash:tx.hash,timeout:60000});}
 tx.status=receipt.status==='reverted'?'reverted':'confirmed';tx.gasPaidWei=(receipt.gasUsed*receipt.effectiveGasPrice).toString();save();const after=await read(job.marketId!);
 let reason='';try{await publicClient.call({account:rejectionClient.account,to:dep.market,data:encodeFunctionData({abi,functionName,args})});}catch(e:any){reason=(e.shortMessage||e.message).slice(0,1800);}
 const pass=receipt.status==='reverted'&&before.state===after.state&&before.reserve===after.reserve&&before.evidenceHash===after.evidenceHash;
 results.cases.push({name,expectedError:expected[name],actualError,status:pass?'PASS':'FAIL',tx:tx.hash,url:tx.url,reason,before,after,gasPaidWei:tx.gasPaidWei});persist();if(!pass)throw Error(`Tamper case failed ${name}`);console.log(`${name}: rejected, reserves unchanged ${tx.url}`);
}
let job=state.jobs.find(j=>(j as any).smokeRun);
if(!job){if(results.cases.length){fs.mkdirSync('docs/evidence/archive',{recursive:true});fs.copyFileSync(output,`docs/evidence/archive/chain-smoke-${Date.now()}.json`);results={network:'Base Sepolia',chainId:84532,contract:dep.market,cases:[]};}const p=await propose('Create a bounded ETH/USD observation market with one test credit and a clear source rule.','1000000');const created=authorize(p.id);job=state.jobs.find(j=>j.id===created.id)!;(job as any).smokeRun=true;save();results.proposalId=p.id;results.llm=p.llm;persist();}
if(['complete','refunded'].includes(job.status)){console.log('Existing smoke completed; no fresh funds spent');process.exit(0);}
try{
 await runJob(job);if(!job.marketId)throw Error('No market');results.marketId=job.marketId;results.intentId=job.intentId;results.mandateId=job.mandateId;persist();
 const p=job.proposal;
 while(Number((await publicClient.getBlock()).timestamp)<Math.max(p.observationStart,Number(p.observation.envelope.timestamp)+125)){console.log('Waiting for immutable observation window and authentic stale-response test');await new Promise(r=>setTimeout(r,15000));}
 const fresh=await observe(),btc=await observe('BTC/USD'),e=fresh.envelope,old=p.observation.envelope;
 const args=(env:any)=>[BigInt(job!.marketId!),BigInt(env.timestamp),toHex(env.data),env.signature];
 await reject(job,'edited-value',args({...e,data:e.data.replace(/"price":\s*([\d.]+)/,(_m,n)=>`"price":${Number(n)+1}`)}));
 await reject(job,'stale-real-response',args(old));
 await reject(job,'different-request',args(btc.envelope));
 const signature=await wallet('buyer').signMessage({message:{raw:keccak256(encodePacked(['bytes32','uint256','bytes'],[requestHash,BigInt(e.timestamp),toHex(e.data)]))}});
 await reject(job,'wrong-signer',args({...e,signature}));
 await reject(job,'duplicate-intent',[BigInt(job.marketId),p.side==='yes',job.mandateId,job.intentId],'fund');
 // All four tamper failures precede the valid action on this same protected market.
 (job as any).tamperValidated=true;save();await runJob(job);
 const final=await read(job.marketId);results.finalMarket=final;results.job=publicJob(job);results.completedAt=new Date().toISOString();results.validAction=job.transactions.find(t=>t.label==='settle-market');if(results.validAction)delete results.validAction.raw;results.payout=job.transactions.filter(t=>t.label.endsWith(':claim')).map(({raw,receipt,...t})=>t);persist();exportEvidence();console.log(`Market ${job.marketId} ${job.status}; settlement and payout recorded`);
}catch(e:any){job.status='error';job.error=e.shortMessage||e.message;event(job,'error',job.error!);persist();console.error(job.error);process.exitCode=1;}
