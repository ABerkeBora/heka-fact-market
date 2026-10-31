import {encodeFunctionData,isAddressEqual,keccak256,type Abi,type Address} from 'viem';
import {estimateL1Fee} from 'viem/op-stack';
import {deployment,publicClient,wallet,type Role} from './config.js';
import {state,save,event,type Job,type TxRecord} from './store.js';

export const PER_TRANSACTION_GAS_CAP=50000000000000n;
export const TOTAL_GAS_CAP=200000000000000n;
const jsonReceipt=(r:any)=>JSON.parse(JSON.stringify(r,(_,v)=>typeof v==='bigint'?v.toString():v));
const roleQueues=new Map<Role,Promise<void>>();

/** Worker and judge routes share one queue per signing role. A failed task still releases its slot. */
export async function serializeRole<T>(role:Role,operation:()=>Promise<T>):Promise<T>{
 const previous=roleQueues.get(role)||Promise.resolve();
 let release!:()=>void;
 const current=new Promise<void>(resolve=>{release=resolve;});
 roleQueues.set(role,current);
 await previous;
 try{return await operation();}
 finally{release();if(roleQueues.get(role)===current)roleQueues.delete(role);}
}

/** Confirmed/reverted fees remain spent; unresolved signed transactions retain their full reservation. */
export function gasCommitment(transactions:TxRecord[],role:string):bigint{
 return transactions.filter(t=>t.role===role).reduce((total,t)=>{
  if(t.gasPaidWei!==undefined && t.feeAccounting==='complete')return total+BigInt(t.gasPaidWei);
  if(t.raw || t.maxGasWei!==undefined || t.gasPaidWei!==undefined)return total+BigInt(t.maxGasWei||PER_TRANSACTION_GAS_CAP);
  return total;
 },0n);
}

export function receiptFeeBreakdown(receipt:any){
 const l2=BigInt(receipt.gasUsed)*BigInt(receipt.effectiveGasPrice);
 const hasL1=receipt.l1Fee!==undefined && receipt.l1Fee!==null;
 const l1=hasL1?BigInt(receipt.l1Fee):undefined;
 const operator=receipt.operatorFee!==undefined && receipt.operatorFee!==null?BigInt(receipt.operatorFee):0n;
 return {l2GasPaidWei:l2.toString(),l1FeePaidWei:l1?.toString(),operatorFeePaidWei:operator.toString(),gasPaidWei:hasL1?(l2+l1!+operator).toString():undefined,feeAccounting:hasL1?'complete':'partial'};
}

/** Every new signature is constrained centrally, including judge submissions. */
export function assertPinnedTool(job:Job,role:Role,address:Address,functionName:string,args:any[],actualAddress:Address,currentDeployment:{market:string,collateral:string}){
 const p=job.proposal,m=p?.mandatePreview;
 if(!m||Number(m.chainId)!==84532)throw Error('Missing pinned Base Sepolia mandate');
 const expectedRole=role==='buyer'?m.beneficiary:role==='counterparty'?m.counterparty:m.executor;
 const same=(a:any,b:any)=>typeof a==='string'&&typeof b==='string'&&isAddressEqual(a as Address,b as Address);
 if(!same(actualAddress,expectedRole)||!same(currentDeployment.market,m.recipient)||!same(currentDeployment.collateral,m.collateralAddress))throw Error('Authorized role, contract or token changed; no new signature');
 const market=same(address,m.recipient),collateral=same(address,m.collateralAddress);
 const investor=role==='buyer'||role==='counterparty';
 if(collateral){
  if(!investor||!['faucet','approve'].includes(functionName))throw Error('Collateral tool is outside the mandate');
  if(functionName==='faucet'&&args.length!==0)throw Error('Faucet arguments are not permitted');
  if(functionName==='approve'&&(!same(args[0],m.recipient)||BigInt(args[1])!==BigInt(p.stakeUnits)))throw Error('Approval must be exact and only for the pinned market');
  return;
 }
 if(!market)throw Error('Recipient is outside the mandate');
 if(investor&&!['authorizeMandate','fund'].includes(functionName))throw Error('Investor market tool is outside the mandate');
 if(role==='deployer'&&!['createMarket','settle','voidMarket','claim'].includes(functionName))throw Error('Executor market tool is outside the mandate');
 if(functionName==='authorizeMandate'&&(args[0]!==job.mandateId||BigInt(args[1])!==BigInt(m.perActionStakeUnits)||BigInt(args[2])!==BigInt(m.totalStakeUnits)||Number(args[3])!==Number(m.maxActions)||BigInt(args[4])!==BigInt(m.expiry)))throw Error('On-chain mandate differs from initial authorization');
 if(['fund','settle','voidMarket','claim'].includes(functionName)&&String(args[0])!==String(job.marketId))throw Error('Market differs from the pinned intent');
 if(functionName==='fund'){
  const expectedIntent=role==='buyer'?job.intentId:keccak256(new TextEncoder().encode('counter:'+job.id));
  const expectedSide=role==='buyer'?p.side==='yes':p.side!=='yes';
  if(args[1]!==expectedSide||args[2]!==job.mandateId||args[3]!==expectedIntent)throw Error('Funding side or intent differs from initial authorization');
 }
 if(functionName==='createMarket'){
  const expected=[p.threshold18,p.stakeUnits,p.closesAt,p.observationStart,p.observationEnd];
  if(args.length!==expected.length||args.some((a,i)=>BigInt(a)!==BigInt(expected[i])))throw Error('Resolution policy differs from initial authorization');
 }
 if(functionName==='claim'&&!same(args[1],m.beneficiary)&&!same(args[1],m.counterparty))throw Error('Claim beneficiary is outside the mandate');
}

async function getReceipt(hash:`0x${string}`){
 try{return await publicClient.getTransactionReceipt({hash});}
 catch(error:any){
  if(error.name==='TransactionReceiptNotFoundError')return undefined;
  throw Error('Receipt lookup failed; no new transaction will be signed until reconciliation is available');
 }
}
async function recordReceipt(job:Job,tx:TxRecord,receipt:any){
 // OP receipts include L1 data fees in addition to gasUsed * effectiveGasPrice.
 // If the formatter omits L1 fees, ask the same RPC for the raw receipt instead of silently reporting zero.
 let feesReceipt=receipt;
 if(receipt.l1Fee===undefined||receipt.l1Fee===null){
  try{const raw:any=await publicClient.request({method:'eth_getTransactionReceipt',params:[tx.hash]});if(raw)feesReceipt={...receipt,...raw};}catch{}
 }
 tx.receipt=jsonReceipt(receipt);
 Object.assign(tx,receiptFeeBreakdown(feesReceipt));
 const previous=tx.status;
 tx.status=receipt.status==='success'?'confirmed':'reverted';save();
 if(previous!==tx.status)event(job,tx.status,`${tx.label}: ${tx.status} on Base Sepolia${tx.feeAccounting==='partial'?'; L1 fee unavailable, full reservation retained':''}`);
}

async function reconcileOtherIntents(role:Role,current?:TxRecord){
 for(const job of state.jobs){
  for(const pending of job.transactions.filter(t=>t.role===role && t!==current && (!['confirmed','reverted'].includes(t.status)||t.feeAccounting!=='complete'))){
   const receipt=await getReceipt(pending.hash);
   if(receipt){await recordReceipt(job,pending,receipt);continue;}
   throw Error(`Role ${role} has unresolved transaction ${pending.hash}; resume its original job before signing another intent`);
  }
 }
}

/** Reconcile an already signed intent without consulting keys, expiry or current tool settings. */
async function reconcileSignedTransaction(job:Job,tx:TxRecord,timeout:number){
 let receipt=await getReceipt(tx.hash);
 if(!receipt){
  if(!tx.raw)throw Error(`${tx.label} has no signed transaction to reconcile; refusing a new signature`);
  try{await publicClient.sendRawTransaction({serializedTransaction:tx.raw});}
  catch(error:any){if(!/already known|nonce too low|known transaction/i.test(error.message)){tx.status='pending';save();throw Error(`${tx.label} broadcast uncertain; exact signed intent retained for reconciliation`);}}
  try{receipt=await publicClient.waitForTransactionReceipt({hash:tx.hash,timeout,confirmations:1});}
  catch{tx.status='pending';save();throw Error(`${tx.label} pending; resume reconciles the existing transaction`);}
 }
 await recordReceipt(job,tx,receipt);
 return receipt;
}

/** Drain every unresolved journal entry before deciding that a job is complete or refundable.
 * Reverted receipts are terminal, paid outcomes and do not stop reconciliation of later entries.
 * Only the persisted raw bytes may be broadcast; this path cannot create another signature.
 */
export async function reconcileJobTransactions(job:Job){
 const unresolved=job.transactions.filter(tx=>!['confirmed','reverted'].includes(tx.status));
 if(unresolved.length===0)return [];
 if(await publicClient.getChainId()!==84532)throw Error('RPC must be Base Sepolia');
 const reconciled:{label:string,role:string,hash:`0x${string}`,status:string}[]=[];
 for(const tx of unresolved){
  if(!['buyer','counterparty','deployer'].includes(tx.role))throw Error('Unrecognized journal role; no transaction broadcast');
  await serializeRole(tx.role as Role,async()=>{
   // A concurrent worker/judge may have reconciled this entry while it waited for the role lock.
   if(!['confirmed','reverted'].includes(tx.status))await reconcileSignedTransaction(job,tx,30000);
   reconciled.push({label:tx.label,role:tx.role,hash:tx.hash,status:tx.status});
  });
 }
 return reconciled;
}

export async function transact(job:Job,label:string,role:Role,address:Address,abi:Abi,functionName:string,args:any[]=[]){
 return serializeRole(role,async()=>{
  let tx=job.transactions.find(t=>t.label===label);
  if(tx?.status==='confirmed'){if(tx.feeAccounting!=='complete'){const receipt=await getReceipt(tx.hash);if(receipt)await recordReceipt(job,tx,receipt);}return tx.receipt;}
  if(tx?.status==='reverted'){if(tx.feeAccounting!=='complete'){const receipt=await getReceipt(tx.hash);if(receipt)await recordReceipt(job,tx,receipt);}throw Error(`${label} reverted; gas was spent and this intent will not be signed again`);}
  if(await publicClient.getChainId()!==84532)throw Error('RPC must be Base Sepolia');
  const client=wallet(role);
  if(!tx){
   await reconcileOtherIntents(role);
   const currentDeployment=deployment();
   if(!currentDeployment)throw Error('No deployment to validate against the mandate');
   assertPinnedTool(job,role,address,functionName,args,client.account.address,currentDeployment);
   const chainNow=Number((await publicClient.getBlock()).timestamp);
   const expiry=Number(job.proposal?.mandatePreview?.expiry);
   if(!Number.isSafeInteger(expiry)||chainNow>=expiry)throw Error('Agent mandate expired; existing signed transactions may be reconciled but no new transaction will be signed');
   // A pending nonce outside the journal (for example a separate CLI invocation) is also a stop condition.
   const [latestNonce,pendingNonce]=await Promise.all([
    publicClient.getTransactionCount({address:client.account.address,blockTag:'latest'}),
    publicClient.getTransactionCount({address:client.account.address,blockTag:'pending'})
   ]);
   if(latestNonce!==pendingNonce)throw Error(`Role ${role} has a pending nonce outside the reconciled journal; no new transaction signed`);
   const data=encodeFunctionData({abi,functionName,args});
   const gas=await publicClient.estimateGas({account:client.account,to:address,data});
   const gasLimit=gas*12n/10n;
   const fees=await publicClient.estimateFeesPerGas();
   const l1Estimate=await estimateL1Fee(publicClient,{account:client.account,to:address,data});
   // L1 charges are protocol-priced, so this is a conservative local reservation, not an on-chain L1 fee cap.
   const l1Reservation=l1Estimate*2n+10000000000n;
   const maxCost=gasLimit*fees.maxFeePerGas+l1Reservation;
   if(maxCost>PER_TRANSACTION_GAS_CAP||gasCommitment(job.transactions,role)+maxCost>TOTAL_GAS_CAP)throw Error('Executor gas budget exceeded; no transaction signed');
   const prepared=await client.prepareTransactionRequest({account:client.account,to:address,data,nonce:latestNonce,gas:gasLimit,maxFeePerGas:fees.maxFeePerGas,maxPriorityFeePerGas:fees.maxPriorityFeePerGas});
   const raw=await client.signTransaction(prepared),hash=keccak256(raw);
   tx={label,role,hash,raw,status:'submitted',maxGasWei:maxCost.toString(),estimatedL1FeeWei:l1Estimate.toString(),url:`https://sepolia.basescan.org/tx/${hash}`};
   job.transactions.push(tx);save();
   event(job,'submitted',`${label}: exact signed transaction and gas reservation journaled before broadcast`);
  }
  const receipt=await reconcileSignedTransaction(job,tx,60000);
  if(receipt.status!=='success')throw Error(`${label} reverted; gas was spent and this intent will not be signed again`);
  return tx.receipt;
 });
}
