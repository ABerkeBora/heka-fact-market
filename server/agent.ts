import {randomUUID} from 'node:crypto';
import {decodeEventLog,keccak256,toHex,formatUnits,type Address,type Abi} from 'viem';
import fs from 'node:fs';
import {artifact,deployment,publicClient,wallet} from './config.js';
import {observe} from './provider.js';
import {state,save,event,publicJob,type Job} from './store.js';
import {transact,reconcileJobTransactions} from './transactions.js';
let active=false;
function assertPinned(p:any){const d=deployment(),m=p.mandatePreview;if(!d||!m||Number(m.chainId)!==84532||d.market.toLowerCase()!==m.recipient.toLowerCase()||d.collateral.toLowerCase()!==m.collateralAddress.toLowerCase()||wallet('buyer').account.address.toLowerCase()!==m.beneficiary.toLowerCase()||wallet('counterparty').account.address.toLowerCase()!==m.counterparty.toLowerCase()||wallet('deployer').account.address.toLowerCase()!==m.executor.toLowerCase())throw Error('Authorized contract, token or role changed; restore the pinned deployment and role configuration before resuming');}

export function authorize(proposalId:string){
 const proposal=state.proposals.find(p=>p.id===proposalId);if(!proposal)throw Error('Proposal not found');
 assertPinned(proposal);
 const existing=state.jobs.find(j=>j.proposalId===proposalId);if(existing){state.evidence.push({at:Date.now(),kind:'duplicate-intent',decision:'blocked',jobId:existing.id,reason:'Proposal already authorized; existing intent returned without a new payment'});save();return publicJob(existing);}
 if(proposal.expiresAt<Math.floor(Date.now()/1000))throw Error('Proposal expired; draft again with a fresh observation');
 const id=randomUUID(),job:Job={id,proposalId,proposal,status:'queued',stage:'Authorization',mandateId:keccak256(toHex('mandate:'+id)),intentId:keccak256(toHex('position:'+id)),transactions:[],events:[],createdAt:Math.floor(Date.now()/1000)};
 state.jobs.push(job);event(job,'authorized','Initial bounded mandate accepted. Agent may fund one fixed test position and settle/claim under its pinned policy.');save();return publicJob(job);
}
async function readMarket(id:string){const d=deployment();return await publicClient.readContract({address:d.market,abi:artifact('FactMarket').abi,functionName:'getMarket',args:[BigInt(id)]}) as any;}
export async function runJob(job:Job){
 await reconcileJobTransactions(job);
 assertPinned(job.proposal);
 const d=deployment(),market=d.market as Address,collateral=d.collateral as Address,mAbi=artifact('FactMarket').abi as Abi,cAbi=artifact('TestCollateral').abi as Abi,p=job.proposal;
 if(job.status==='complete'||job.status==='refunded')return;
 job.status='running';job.error=undefined;save();
 if(!job.marketId){
  if(!job.transactions.some(t=>t.label==='create-market') && Math.floor(Date.now()/1000)>=p.closesAt-20)throw Error('Funding window expired; no new position will be opened. Draft a fresh market.');
  for(const role of ['buyer','counterparty'] as const){
   job.stage=`Preparing ${role} test collateral`;save();
   const balance=await publicClient.readContract({address:collateral,abi:cAbi,functionName:'balanceOf',args:[wallet(role).account.address]}) as bigint;
   if(balance<BigInt(p.stakeUnits))await transact(job,`${role}:faucet`,role,collateral,cAbi,'faucet');
   job.stage='Registering bounded mandate';save();
   await transact(job,`${role}:mandate`,role,market,mAbi,'authorizeMandate',[job.mandateId,BigInt(p.stakeUnits),BigInt(p.stakeUnits),1,BigInt(p.mandatePreview.expiry)]);
   await transact(job,`${role}:approve`,role,collateral,cAbi,'approve',[market,BigInt(p.stakeUnits)]);
  }
  job.stage='Creating fixed resolution policy';save();
  const receipt=await transact(job,'create-market','deployer',market,mAbi,'createMarket',[BigInt(p.threshold18),BigInt(p.stakeUnits),BigInt(p.closesAt),BigInt(p.observationStart),BigInt(p.observationEnd)]);
  for(const log of receipt.logs){try{const e=decodeEventLog({abi:mAbi,data:log.data,topics:log.topics});if(e.eventName==='MarketCreated')job.marketId=String((e.args as any).marketId ?? (e.args as any).id);}catch{}}
  if(!job.marketId)throw Error('Market receipt has no creation event; refusing to recreate');save();
 }
 let current=await readMarket(job.marketId);let now=Number((await publicClient.getBlock()).timestamp);
 const zero='0x0000000000000000000000000000000000000000';
 if(Number(current.state)===0 && now<p.closesAt){
  const buyerOwner=p.side==='yes'?current.yesOwner:current.noOwner;
  if(buyerOwner===zero){job.stage='Funding agent position';save();await transact(job,'agent:fund','buyer',market,mAbi,'fund',[BigInt(job.marketId),p.side==='yes',job.mandateId,job.intentId]);}
  current=await readMarket(job.marketId);
  const counterOwner=p.side==='yes'?current.noOwner:current.yesOwner;
  if(counterOwner===zero){job.stage='Funding opposing test role';save();await transact(job,'counterparty:fund','counterparty',market,mAbi,'fund',[BigInt(job.marketId),p.side!=='yes',job.mandateId,keccak256(toHex('counter:'+job.id))]);}
  current=await readMarket(job.marketId);now=Number((await publicClient.getBlock()).timestamp);
 }
 const unmatched=current.yesOwner===zero||current.noOwner===zero;
 if(Number(current.state)===0 && unmatched && now>=p.closesAt){job.stage='Unmatched position · refunding';save();await transact(job,'void-market','deployer',market,mAbi,'voidMarket',[BigInt(job.marketId)]);}
 else if(Number(current.state)===0 && now<p.observationStart){job.status='waiting';job.stage='Waiting for observation window';save();return;}
 else if(Number(current.state)===0){
  if(now>p.observationEnd){job.stage='No qualifying observation · refunding';save();await transact(job,'void-market','deployer',market,mAbi,'voidMarket',[BigInt(job.marketId)]);}
  else{
   if(Number((job as any).observationCalls||0)>=32){job.status='waiting';job.stage='Observation call limit reached · awaiting refund deadline';save();return;}
   job.stage='Obtaining signed observation';(job as any).observationCalls=Number((job as any).observationCalls||0)+1;save();
   let observation;try{observation=await observe();}catch(e:any){job.status='waiting';job.stage='Observation unavailable · retrying within approved window';job.error=e.message;event(job,'oracle-rejected',e.message);return;}
   if(observation.sourceAt<p.observationStart){job.status='waiting';job.stage='Waiting for a source update inside the window';save();return;}
   if(observation.sourceAt>p.observationEnd){job.status='waiting';job.stage='No qualifying observation · awaiting refund deadline';save();return;}
   (job as any).settlementObservation=observation;save();
   const e=observation.envelope;
   job.stage='Submitting verified evidence';save();await transact(job,'settle-market','deployer',market,mAbi,'settle',[BigInt(job.marketId),BigInt(e.timestamp),toHex(e.data),e.signature]);
  }
 }
 job.stage='Collecting contract-enforced payout';save();
 for(const role of ['buyer','counterparty'] as const){
  // A losing side has no claim; a successful settlement cannot be undone by a redundant claim.
  const m=await readMarket(job.marketId);const outcome=Number(m.state??m.status??0);
  const address=wallet(role).account.address;const ownsYes=m.yesOwner.toLowerCase()===address.toLowerCase();const ownsNo=m.noOwner.toLowerCase()===address.toLowerCase();
  if((!ownsYes&&!ownsNo)||(ownsYes&&m.yesClaimed)||(ownsNo&&m.noClaimed))continue;
  const isWinner=(outcome===1&&p.side===(role==='buyer'?'yes':'no'))||(outcome===2&&p.side===(role==='buyer'?'no':'yes'));
  if(outcome===3||isWinner)await transact(job,`${role}:claim`,'deployer',market,mAbi,'claim',[BigInt(job.marketId),wallet(role).account.address]);
 }
 const final=await readMarket(job.marketId);job.status=Number(final.state??final.status)===3?'refunded':'complete';job.stage=job.status==='complete'?'Resolved and collected':'Voided and refunded';event(job,'delivered',job.stage);save();exportEvidence();
}
export async function tick(){if(active)return;active=true;try{for(const job of state.jobs.filter(j=>['queued','running','waiting'].includes(j.status))){try{await runJob(job);}catch(e:any){job.status='error';job.error=e.shortMessage||e.message;event(job,'error',job.error!);}}}finally{active=false;}}
export function resume(id:string){const j=state.jobs.find(x=>x.id===id);if(!j)throw Error('Job not found');if(['complete','refunded'].includes(j.status)&&!j.transactions.some(t=>!['confirmed','reverted'].includes(t.status)))return publicJob(j);j.status='queued';j.error=undefined;save();return publicJob(j);}
export function exportEvidence(){fs.writeFileSync('docs/evidence/agent-runs.json',JSON.stringify({generatedAt:new Date().toISOString(),jobs:state.jobs.map(publicJob),rejections:state.evidence},null,2)+'\n');}
export async function marketState(){const d=deployment();if(!d)return[];return await Promise.all(state.jobs.filter(j=>j.marketId).map(async j=>{
 try{const m=await readMarket(j.marketId!);const zero='0x0000000000000000000000000000000000000000'; const outcome=Number(m.state); return {...j.proposal,...m,explanation:`Agent selected ${j.proposal.side.toUpperCase()} with validated threshold $${j.proposal.thresholdUsd}. The first qualifying source observation determines the outcome.`,id:j.marketId,address:d.market,jobId:j.id,jobStatus:j.status,status:['Open','YES won','NO won','Voided'][outcome],outcome:['Pending','YES','NO','VOID'][outcome],reserveUnits:formatUnits(m.reserve,6),yesStakeUnits:m.yesOwner===zero?'0':formatUnits(m.stake,6),noStakeUnits:m.noOwner===zero?'0':formatUnits(m.stake,6),payoutUnits:formatUnits((m.yesClaimed||m.noClaimed)?(outcome===3?(m.yesClaimed?m.stake:0n)+(m.noClaimed?m.stake:0n):m.stake*2n):0n,6),settlementPrice:m.observedPrice?formatUnits(m.observedPrice,18):undefined,sourceObservedAt:m.sourceTimestamp.toString(),signedAt:m.signedTimestamp.toString(),envelope:(j as any).settlementObservation?.envelope,transactions:publicJob(j).transactions};}catch{return {id:j.marketId,jobId:j.id,error:'Could not refresh chain state'};}
}));}
