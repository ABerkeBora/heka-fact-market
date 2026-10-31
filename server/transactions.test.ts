import test from 'node:test';
import assert from 'node:assert/strict';
import {setImmediate} from 'node:timers/promises';
import {assertPinnedTool,gasCommitment,receiptFeeBreakdown,serializeRole,PER_TRANSACTION_GAS_CAP} from './transactions.js';
import type {TxRecord} from './store.js';
const tx=(overrides:Partial<TxRecord>):TxRecord=>({label:'test',role:'buyer',hash:'0x01',status:'pending',url:'',...overrides});
test('gas budget counts actual confirmed and reverted spend plus full pending reservations',()=>{
 assert.equal(gasCommitment([tx({status:'confirmed',gasPaidWei:'11',feeAccounting:'complete'}),tx({status:'reverted',gasPaidWei:'7',feeAccounting:'complete'}),tx({maxGasWei:'100',raw:'0x01'}),tx({role:'counterparty',maxGasWei:'500'})],'buyer'),118n);
});
test('legacy pending transactions and partial fee receipts retain a conservative reservation',()=>{
 assert.equal(gasCommitment([tx({raw:'0x01'}),tx({status:'confirmed',gasPaidWei:'5',maxGasWei:'100',feeAccounting:'partial'})],'buyer'),PER_TRANSACTION_GAS_CAP+100n);
});
test('receipt accounting includes L1 fee and does not silently label absent L1 as zero',()=>{
 assert.deepEqual(receiptFeeBreakdown({gasUsed:3n,effectiveGasPrice:4n,l1Fee:'0x05'}),{l2GasPaidWei:'12',l1FeePaidWei:'5',operatorFeePaidWei:'0',gasPaidWei:'17',feeAccounting:'complete'});
 assert.equal(receiptFeeBreakdown({gasUsed:3n,effectiveGasPrice:4n}).gasPaidWei,undefined);
 assert.equal(receiptFeeBreakdown({gasUsed:3n,effectiveGasPrice:4n}).feeAccounting,'partial');
});
test('same-role calls serialize and failures release the queue; other roles remain independent',async()=>{
 const order:string[]=[];let release!:()=>void;const gate=new Promise<void>(r=>release=r);
 const first=serializeRole('buyer',async()=>{order.push('first');await gate;throw Error('expected');});
 const rejected=assert.rejects(first,/expected/);
 const second=serializeRole('buyer',async()=>{order.push('second');return 2;});
 await serializeRole('counterparty',async()=>{order.push('other');});
 await setImmediate();assert.deepEqual(order,['first','other']);release();
 await rejected;assert.equal(await second,2);assert.deepEqual(order,['first','other','second']);
});

const pinned=()=>{
 const market='0x1111111111111111111111111111111111111111' as const,collateral='0x2222222222222222222222222222222222222222' as const,buyer='0x3333333333333333333333333333333333333333' as const;
 const job:any={id:'j',marketId:'1',mandateId:'0x01',intentId:'0x02',proposal:{side:'yes',stakeUnits:'1000000',mandatePreview:{chainId:84532,recipient:market,collateralAddress:collateral,beneficiary:buyer,counterparty:'0x4444444444444444444444444444444444444444',executor:'0x5555555555555555555555555555555555555555'}}};
 return {job,market,collateral,buyer,deployment:{market,collateral}};
};
test('new-sign validator pins role, recipient, exact approval amount and tool',()=>{
 const {job,market,collateral,buyer,deployment}=pinned();
 assert.doesNotThrow(()=>assertPinnedTool(job,'buyer',collateral,'approve',[market,1000000n],buyer,deployment));
 assert.throws(()=>assertPinnedTool(job,'buyer',market,'settle',[1n],buyer,deployment),/outside/);
 assert.throws(()=>assertPinnedTool(job,'buyer',collateral,'approve',[buyer,1000000n],buyer,deployment),/Approval/);
 assert.throws(()=>assertPinnedTool(job,'buyer',collateral,'approve',[market,1000001n],buyer,deployment),/Approval/);
 assert.throws(()=>assertPinnedTool(job,'buyer',buyer,'faucet',[],buyer,deployment),/Recipient/);
 assert.throws(()=>assertPinnedTool(job,'buyer',collateral,'faucet',[],market,deployment),/role/);
});
test('new-sign validator rejects cross-market and changed funding side/intent',()=>{
 const {job,market,buyer,deployment}=pinned();
 assert.doesNotThrow(()=>assertPinnedTool(job,'buyer',market,'fund',[1n,true,'0x01','0x02'],buyer,deployment));
 assert.throws(()=>assertPinnedTool(job,'buyer',market,'fund',[2n,true,'0x01','0x02'],buyer,deployment),/Market/);
 assert.throws(()=>assertPinnedTool(job,'buyer',market,'fund',[1n,false,'0x01','0x02'],buyer,deployment),/Funding/);
 assert.throws(()=>assertPinnedTool(job,'buyer',market,'fund',[1n,true,'0x01','0x03'],buyer,deployment),/Funding/);
});
