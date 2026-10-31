import {SmartContract,prop,method,ByteString,assert,Utils,reverseByteString,toByteString,len,hash256,Tx,SigHash,SigHashPreimage,Ripemd160} from 'scrypt-ts'
import {SECP256K1,Point,Signature} from 'scrypt-ts-lib'
import {KeccakOneBlock} from './keccak'
import {NodaryParser} from './nodary-parser'

/** Experimental native original-Airnode consumer. No relayer key or backend digest. */
export class NodaryOutcome extends SmartContract {
 @prop() requestHash:ByteString
 @prop() airnodePublicKey:Point
 @prop() validFrom:bigint
 @prop() validTo:bigint
 @prop() threshold18:bigint
 @prop() collateralSatoshis:bigint
 @prop() yesRecipientScript:ByteString
 @prop() noRecipientScript:ByteString
 @prop() refundAfter:bigint
 @prop() refundBuyerScript:ByteString
 @prop() refundCounterpartyScript:ByteString
 @prop() buyerStakeSatoshis:bigint
 constructor(requestHash:ByteString,airnodePublicKey:Point,validFrom:bigint,validTo:bigint,threshold18:bigint,collateralSatoshis:bigint,yesRecipientScript:ByteString,noRecipientScript:ByteString,refundAfter:bigint,refundBuyerScript:ByteString,refundCounterpartyScript:ByteString,buyerStakeSatoshis:bigint){
  super(...arguments)
  this.requestHash=requestHash;this.airnodePublicKey=airnodePublicKey;this.validFrom=validFrom;this.validTo=validTo;this.threshold18=threshold18;this.collateralSatoshis=collateralSatoshis;this.yesRecipientScript=yesRecipientScript;this.noRecipientScript=noRecipientScript;this.refundAfter=refundAfter;this.refundBuyerScript=refundBuyerScript;this.refundCounterpartyScript=refundCounterpartyScript;this.buyerStakeSatoshis=buyerStakeSatoshis
 }
 @method() public spend(refund:boolean,timestamp:bigint,data:ByteString,signature:Signature,preimage:SigHashPreimage,changeAmount:bigint,changeAddress:Ripemd160){
  assert(len(this.requestHash)===32n && this.validFrom<=this.validTo && this.refundAfter>this.validTo && this.collateralSatoshis>0n && this.threshold18>0n && this.buyerStakeSatoshis>0n && this.buyerStakeSatoshis<this.collateralSatoshis,'invalid immutable policy')
  let expectedOutputs=Utils.buildOutput(this.refundBuyerScript,this.buyerStakeSatoshis)+Utils.buildOutput(this.refundCounterpartyScript,this.collateralSatoshis-this.buyerStakeSatoshis)
  if(!refund){
   assert(timestamp>=this.validFrom && timestamp<=this.validTo,'signed timestamp outside policy')
   const packed=this.requestHash+reverseByteString(Utils.toLEUnsigned(timestamp,32n),32n)+data
   const inner=KeccakOneBlock.digest(packed)
   const digest=KeccakOneBlock.digest(toByteString('19457468657265756d205369676e6564204d6573736167653a0a3332')+inner)
   assert(SECP256K1.verifySig(Utils.fromLEUnsigned(reverseByteString(digest,32n)),signature,this.airnodePublicKey),'original signature mismatch')
   const observation=NodaryParser.read(data)
   assert(observation.sourceTimestamp>=this.validFrom && observation.sourceTimestamp<=this.validTo,'source timestamp outside policy')
   assert(observation.sourceTimestamp<=timestamp+5n && timestamp<=observation.sourceTimestamp+120n,'source/signature lag')
   const winnerScript=observation.price18>this.threshold18?this.yesRecipientScript:this.noRecipientScript
   expectedOutputs=Utils.buildOutput(winnerScript,this.collateralSatoshis)
  }
  // Explicit preimage check occurs AFTER the separator; no implicit this.ctx preimage at method entry.
  this.insertCodeSeparator()
  assert(this.checkPreimageSigHashType(preimage,SigHash.ALL),'transaction preimage mismatch')
  assert(SigHash.value(preimage)===this.collateralSatoshis,'wrong collateral value')
  if(refund){assert(SigHash.nSequence(preimage)<0xffffffffn && SigHash.nLocktime(preimage)>=this.refundAfter,'refund not mature')}
  assert(changeAmount>=0n,'negative change')
  const change=changeAmount>0n?Utils.buildPublicKeyHashOutput(changeAddress,changeAmount):toByteString('')
  assert(SigHash.hashOutputs(preimage)===hash256(expectedOutputs+change),'fixed payout outputs mismatch')
 }
}
