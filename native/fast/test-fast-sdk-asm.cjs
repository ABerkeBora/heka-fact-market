const fs=require('fs'),assert=require('assert/strict'),{parseUnits}=require('viem')
const {Transaction,TransactionSignature,LockingScript}=require('@bsv/sdk')
const {bsv,getPreimage,DEFAULT_SIGHASH_TYPE}=require('scryptlib')
const {createNodaryFastAsm,verifyRaw}=require('./consumer-fast-asm.cjs')
const f=JSON.parse(fs.readFileSync('fixture.json')),e=f.envelope,t=BigInt(e.timestamp),d=JSON.parse(e.data)
const yes='76a914'+'11'.repeat(20)+'88ac',no='76a914'+'22'.repeat(20)+'88ac',fee='76a914'+'33'.repeat(20)+'88ac'
const policy={requestHash:e.requestHash,airnodePublicKey:f.publicKey,expectedAirnodeAddress:f.address,validFrom:BigInt(d.updatedAt)/1000n-1n,validTo:t+1n,threshold18:parseUnits(String(d.price),18)-1n,collateralSatoshis:2000n,yesRecipientScript:yes,noRecipientScript:no,refundAfter:t+120n,refundBuyerScript:yes,refundCounterpartyScript:no,buyerStakeSatoshis:1000n}
const guard=createNodaryFastAsm(policy),legacy=new bsv.Transaction()
legacy.addInput(new bsv.Transaction.Input({prevTxId:Buffer.alloc(32,1),outputIndex:0,script:bsv.Script.empty(),sequenceNumber:0xfffffffe,output:new bsv.Transaction.Output({script:bsv.Script.fromHex(guard.lockingHex),satoshis:2000})}))
legacy.addInput(new bsv.Transaction.Input({prevTxId:Buffer.alloc(32,2),outputIndex:0,script:bsv.Script.empty(),sequenceNumber:0xfffffffe,output:new bsv.Transaction.Output({script:bsv.Script.fromHex(fee),satoshis:1000})}))
legacy.addOutput(new bsv.Transaction.Output({script:bsv.Script.fromHex(yes),satoshis:2000}));legacy.addOutput(new bsv.Transaction.Output({script:bsv.Script.fromHex(fee),satoshis:900}))
const tx=Transaction.fromHex(legacy.toString()),pre=TransactionSignature.format({sourceTXID:tx.inputs[0].sourceTXID,sourceOutputIndex:0,sourceSatoshis:2000,transactionVersion:tx.version,otherInputs:tx.inputs.filter((_,i)=>i!==0),inputIndex:0,outputs:tx.outputs,inputSequence:tx.inputs[0].sequence,subscript:LockingScript.fromHex(guard.postSeparatorScriptHex),lockTime:tx.lockTime,scope:TransactionSignature.SIGHASH_ALL|TransactionSignature.SIGHASH_FORKID})
const sdkHex=Buffer.from(pre).toString('hex');assert.equal(sdkHex,getPreimage(legacy,bsv.Script.fromHex(guard.postSeparatorScriptHex),2000,0,DEFAULT_SIGHASH_TYPE))
const unlock=guard.unlock({envelope:e,preimageHex:sdkHex,changeAmount:900n,changePublicKeyHash:'33'.repeat(20)});legacy.inputs[0].setScript(bsv.Script.fromHex(unlock))
const actual=verifyRaw({policy,rawTransaction:legacy.toString(),sourceSatoshis:2000});assert(actual.success,actual.error)
const result={checkedAt:new Date().toISOString(),status:'PASS',scope:'Local actual serialized dummy tx, sponsor SDK3.2.1 preimage and compiled native optimized consumer; no funding or broadcast',sdkVersion:'3.2.1',preimageEqual:true,sighash:65,preimageBytes:pre.length,unlockingBytes:unlock.length/2,protectedPayout:2000,sponsorInput:1000,sponsorChange:900,localVm:actual,...guard.info}
fs.writeFileSync('fast-asm-sdk-results.json',JSON.stringify(result,null,2)+'\n');console.log(result)
