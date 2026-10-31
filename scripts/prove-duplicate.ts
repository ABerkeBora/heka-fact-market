import fs from 'node:fs';
import {encodeFunctionData,keccak256} from 'viem';
import {acquireProcessLock} from '../server/lock.js';
import {artifact,deployment,publicClient,wallet} from '../server/config.js';
import {state,save,publicJob} from '../server/store.js';
acquireProcessLock('duplicate-intent proof');
const p='docs/evidence/chain-smoke.json',report=JSON.parse(fs.readFileSync(p,'utf8')),job=state.jobs.find(j=>j.marketId===report.marketId)!,d=deployment(),abi=artifact('FactMarket').abi,client=wallet('buyer');
const args=[BigInt(job.marketId!),job.proposal.side==='yes',job.mandateId,job.intentId];
let errorName='';try{await publicClient.simulateContract({account:client.account,address:d.market,abi,functionName:'fund',args});}catch(e:any){errorName=e.walk?.((e:any)=>e.name==='ContractFunctionRevertedError')?.data?.errorName;}
if(errorName!=='DuplicateIntent')throw Error('Expected DuplicateIntent before spending gas, got '+errorName);
let tx=job.transactions.find(t=>t.label==='tamper:duplicate-buyer');const before:any=await publicClient.readContract({address:d.market,abi,functionName:'getMarket',args:[BigInt(job.marketId!)]});
if(!tx){const prepared=await client.prepareTransactionRequest({account:client.account,to:d.market,data:encodeFunctionData({abi,functionName:'fund',args}),gas:200000n});const raw=await client.signTransaction(prepared),hash=keccak256(raw);tx={label:'tamper:duplicate-buyer',role:'buyer',hash,raw,status:'submitted',url:`https://sepolia.basescan.org/tx/${hash}`};job.transactions.push(tx);save();}
let receipt;try{receipt=await publicClient.getTransactionReceipt({hash:tx.hash});}catch{}
if(!receipt){try{await publicClient.sendRawTransaction({serializedTransaction:tx.raw!});}catch(e:any){if(!/already known|nonce too low/.test(e.message))throw e;}receipt=await publicClient.waitForTransactionReceipt({hash:tx.hash});}
const after:any=await publicClient.readContract({address:d.market,abi,functionName:'getMarket',args:[BigInt(job.marketId!)]});tx.status=receipt.status==='reverted'?'reverted':'confirmed';tx.gasPaidWei=(receipt.gasUsed*receipt.effectiveGasPrice).toString();save();
const old=report.cases.find((c:any)=>c.name==='duplicate-intent');if(old?.actualError==='MarketClosed'){report.nonQualifyingChecks=[...(report.nonQualifyingChecks||[]),{...old,explanation:'Initial test submitted funding as executor rather than the original buyer. This proved only closed-market rejection and was superseded by the actual buyer-intent replay.'}];}
report.cases=report.cases.filter((c:any)=>c.name!=='duplicate-intent');report.cases.push({name:'duplicate-intent',status:receipt.status==='reverted'&&before.reserve===after.reserve&&before.state===after.state?'PASS':'FAIL',expectedError:'DuplicateIntent',actualError:errorName,tx:tx.hash,url:tx.url,before,after,gasPaidWei:tx.gasPaidWei});report.job=publicJob(job);fs.writeFileSync(p,JSON.stringify(report,(_,v)=>typeof v==='bigint'?v.toString():v,2)+'\n');console.log('Actual buyer duplicate intent: '+tx.status+' '+tx.url);
