import {SmartContractLib,SmartContract,method,prop,assert,ByteString,len,slice,toByteString,Utils} from 'scrypt-ts'
export type NodaryObservation={price18:bigint,sourceTimestamp:bigint}

/** Strict bounded JSON subset emitted by the current pinned price/updatedAt projection. */
export class NodaryParser extends SmartContractLib {
 @method() static read(data:ByteString):NodaryObservation{
  const head=toByteString('7b227072696365223a')
  const tail=toByteString('2c22757064617465644174223a')
  assert(slice(data,0n,len(head))===head,'wrong price prefix')
  let digits=0n
  let scale=1n
  let decimal=false
  let done=false
  let priceEnd=0n
  let count=0n
  for(let i=0;i<32;i++){
   const pos=len(head)+BigInt(i)
   if(!done && pos<len(data)){
    const c=Utils.fromLEUnsigned(slice(data,pos,pos+1n))
    if(c===44n){done=true;priceEnd=pos}
    else if(c===46n){assert(!decimal && count>0n,'invalid decimal');decimal=true}
    else{assert(c>=48n&&c<=57n,'non numeric price');digits=digits*10n+c-48n;count++;if(decimal)scale*=10n}
   }
  }
  assert(done && count>0n && digits>0n && scale<=1000000000000000000n,'invalid price')
  assert(slice(data,priceEnd,priceEnd+len(tail))===tail,'wrong update prefix')
  const start=priceEnd+len(tail)
  assert(len(data)===start+14n,'expected 13 digit millis and closing brace')
  let millis=0n
  for(let i=0;i<13;i++){
   const c=Utils.fromLEUnsigned(slice(data,start+BigInt(i),start+BigInt(i+1)))
   assert(c>=48n&&c<=57n,'invalid source timestamp')
   millis=millis*10n+c-48n
  }
  assert(slice(data,start+13n)===toByteString('7d'),'wrong JSON ending')
  return {price18:digits*1000000000000000000n/scale,sourceTimestamp:millis/1000n}
 }
}

export class NodaryParserTest extends SmartContract {
 @prop() expectedPrice18:bigint
 @prop() expectedSourceTimestamp:bigint
 constructor(expectedPrice18:bigint,expectedSourceTimestamp:bigint){super(...arguments);this.expectedPrice18=expectedPrice18;this.expectedSourceTimestamp=expectedSourceTimestamp}
 @method() public unlock(data:ByteString){const o=NodaryParser.read(data);assert(o.price18===this.expectedPrice18 && o.sourceTimestamp===this.expectedSourceTimestamp,'observation mismatch')}
}
