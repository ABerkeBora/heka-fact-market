import fs from 'node:fs';
import {encodeFunctionData,encodePacked,keccak256,toHex} from 'viem';
import {acquireProcessLock} from '../server/lock.js';
import {artifact,deployment,publicClient,wallet} from '../server/config.js';
import {state as v1State,save as v1Save,event as v1Event,publicJob,type Job} from '../server/store.js';
import {propose as v1Propose} from '../server/proposal.js';
import {observe as v1Observe} from '../server/provider.js';
import {createAgentEngine} from '../server/agent.js';
import {nextStore,nextDeployment,nextWallet} from '../server/next/context.js';
import {nextEngine,nextExecutor} from '../server/next/engine.js';
import {proposeNext} from '../server/next/proposal.js';
import {fetchObservation,getRecipe} from '../server/next/registry.js';
import {receiptFeeBreakdown} from '../server/transactions.js';
acquireProcessLock('V2 live two-feed and V1 regression smoke');
const dep=nextDeployment(),abi=artifact('FactMarketNext').abi;
const output='docs/evidence/v2/chain-smoke.json';
const report:any=fs.existsSync(output)?JSON.parse(fs.readFileSync(output,'utf8')):{network:'Base Sepolia',chainId:84532,contract:dep.market,cases:[],feeds:[]};
const persist=()=>fs.writeFileSync(output,JSON.stringify(report,(_,v)=>typeof v==='bigint'?v.toString():v,2)+'\n');
const read=async(id:string)=>await publicClient.readContract({address:dep.market,abi,functionName:'getMarket',args:[BigInt(id)]}) as any;
const waitWindow=async(until:number)=>{while(Number((await publicClient.getBlock()).timestamp)<until){console.log('Waiting for fixed observation window');await new Promise(r=>setTimeout(r,15000));}};
async function reject(job:Job,name:string,envelope:any){
 if(report.cases.some((c:any)=>c.name===name&&c.status==='PASS'))return;
 const before=await read(job.marketId!),block=await publicClient.getBlock();
 if(Number(before.state)!==0||before.yesOwner==='0x0000000000000000000000000000000000000000'||before.noOwner==='0x0000000000000000000000000000000000000000'||block.timestamp<before.observationStart||block.timestamp>before.observationEnd)throw Error('Tamper proof requires an open matched observation window');
 const client=nextWallet('deployer'),args=[BigInt(job.marketId!),BigInt(envelope.timestamp),toHex(envelope.data),envelope.signature];
 const expected=name==='stale-real-response'?'ResponseTooOld':'NotSignedByAirnode';let actual='';
 try{await publicClient.simulateContract({account:client.account,address:dep.market,abi,functionName:'settle',args});}catch(e:any){actual=e.walk?.((e:any)=>e.name==='ContractFunctionRevertedError')?.data?.errorName||'';}
 if(actual!==expected)throw Error(`${name}: expected ${expected}, got ${actual}; no misleading PASS`);
 const label='v2-proof:'+name;let tx=job.transactions.find(t=>t.label===label);
 if(!tx){const prepared=await client.prepareTransactionRequest({account:client.account,to:dep.market,data:encodeFunctionData({abi,functionName:'settle',args}),gas:500000n});if((prepared.maxFeePerGas||0n)*500000n>50000000000000n)throw Error('Proof gas cap');const raw=await client.signTransaction(prepared),hash=keccak256(raw);tx={label,role:'deployer',hash,raw,status:'submitted',url:`https://sepolia.basescan.org/tx/${hash}`};job.transactions.push(tx);nextStore.save();}
 let receipt;try{receipt=await publicClient.getTransactionReceipt({hash:tx.hash});}catch{}
 if(!receipt){try{await publicClient.sendRawTransaction({serializedTransaction:tx.raw!});}catch(e:any){if(!/already known|nonce too low/i.test(e.message))throw e;}receipt=await publicClient.waitForTransactionReceipt({hash:tx.hash,timeout:60000});}
 const raw:any=await publicClient.request({method:'eth_getTransactionReceipt',params:[tx.hash]});Object.assign(tx,receiptFeeBreakdown(raw));tx.status=receipt.status==='reverted'?'reverted':'confirmed';nextStore.save();
 const after=await read(job.marketId!);const pass=receipt.status==='reverted'&&before.state===after.state&&before.reserve===after.reserve&&before.policyHash===after.policyHash&&before.requestHash===after.requestHash&&before.recipeHash===after.recipeHash;
 report.cases.push({name,marketId:job.marketId,feed:job.proposal.feed,status:pass?'PASS':'FAIL',expectedError:expected,actualError:actual,tx:tx.hash,url:tx.url,receiptBlock:receipt.blockNumber.toString(),before,after});persist();if(!pass)throw Error('Protected state changed during rejected response');console.log(`${name}: ${actual} ${tx.url}`);
}
// Actual rejected invocation: no provider/model HTTP, no new job, no signature or funding.
if(!report.noPayment){const original=globalThis.fetch;let calls=0;const jobsBefore=nextStore.state.jobs.length;globalThis.fetch=async()=>{calls++;throw Error('Unexpected HTTP for unsupported goal');};let reason='',code='';try{await proposeNext('Create a SOL/USD observation market','1000000');}catch(e:any){reason=e.message;code=e.code||'';}finally{globalThis.fetch=original;}if(code!=='UNSUPPORTED_ASSET'||calls||nextStore.state.jobs.length!==jobsBefore)throw Error('Unsupported goal did not stop before payment');report.noPayment={status:'PASS',goal:'SOL/USD',decision:'rejected',code,reason,httpCalls:calls,jobsBefore,jobsAfter:nextStore.state.jobs.length,paymentSubmitted:false};persist();}
const jobs:Job[]=[];
for(const feedId of [0,1]){
 let job=nextStore.state.jobs.find(j=>(j as any).v2SmokeFeed===feedId);
 if(!job){const recipe=getRecipe(feedId),p=await proposeNext(`Create a ${recipe.feed} observation market with a bounded one-credit position.`,'1000000');const j=nextEngine.authorize(p.id);job=nextStore.state.jobs.find(x=>x.id===j.id)!;(job as any).v2SmokeFeed=feedId;nextStore.save();}
 if(!job.marketId||Number((await publicClient.getBlock()).timestamp)<job.proposal.observationStart||report.validActions)await nextEngine.runJob(job);else await nextExecutor.reconcileJobTransactions(job);jobs.push(job);console.log(`${job.proposal.feed}: market ${job.marketId}, ${job.stage}`);
}
const [eth,btc]=jobs;
if(!report.validActions){
 await waitWindow(Math.max(eth!.proposal.observationStart,btc!.proposal.observationStart,Number(eth!.proposal.observation.envelope.timestamp)+125));
 const freshEth=await fetchObservation(0),freshBtc=await fetchObservation(1),e=freshEth.envelope;
 await reject(eth!,'edited-value',{...e,data:e.data.replace(/"price":\s*([\d.]+)/,(_m,n)=>`"price":${Number(n)+1}`)});
 await reject(eth!,'stale-real-response',eth!.proposal.observation.envelope);
 await reject(eth!,'different-request',freshBtc.envelope);
 const signature=await nextWallet('buyer').signMessage({message:{raw:keccak256(encodePacked(['bytes32','uint256','bytes'],[getRecipe(0).requestHash,BigInt(e.timestamp),toHex(e.data)]))}});
 await reject(eth!,'wrong-signer',{...e,signature});
 await reject(btc!,'wrong-feed-ETH-into-BTC',freshEth.envelope);
 for(const job of jobs){await nextEngine.runJob(job);if(job.status!=='complete')throw Error(`${job.proposal.feed} not complete`);}
 report.feeds=await Promise.all(jobs.map(async j=>({feed:j.proposal.feed,feedId:j.proposal.feedId,job:publicJob(j),market:await read(j.marketId!)})));
 report.validActions=jobs.map(j=>({feed:j.proposal.feed,settlement:j.transactions.find(t=>t.label==='settle-market')?.hash,claims:j.transactions.filter(t=>t.label.endsWith(':claim')).map(t=>t.hash)}));persist();nextEngine.exportEvidence();
}
// Same frozen V1 behavior, separate V1 roles/journal; publish its new regression separately.
const v1Regression=createAgentEngine({namespace:'v1',state:v1State,save:v1Save,event:v1Event,wallet,deployment,contractName:'FactMarket',observe:v1Observe,evidencePath:'docs/evidence/v2/v1-regression-runs.json',createMarketArgs:p=>[BigInt(p.threshold18),BigInt(p.stakeUnits),BigInt(p.closesAt),BigInt(p.observationStart),BigInt(p.observationEnd)]});
let reg=v1State.jobs.find(j=>(j as any).v2RegressionRun);
if(!reg){const p=await v1Propose('Create an ETH/USD observation market around the next reported price.','1000000');const j=v1Regression.authorize(p.id);reg=v1State.jobs.find(x=>x.id===j.id)!;(reg as any).v2RegressionRun=true;v1Save();}
await v1Regression.runJob(reg);if(reg.status!=='complete'){await waitWindow(reg.proposal.observationStart+2);await v1Regression.runJob(reg);}
if(reg.status!=='complete')throw Error('V1 regression did not complete');report.v1Regression={status:'PASS',job:publicJob(reg),originalFactory:deployment().market};report.completedAt=new Date().toISOString();persist();console.log('V2 both feeds complete; all four tamper guards, both wrong-feed directions and V1 fresh lifecycle passed');
