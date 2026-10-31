import {SmartContract,SmartContractLib,method,prop,assert,ByteString,Utils,reverseByteString,toByteString} from 'scrypt-ts'
import {KeccakOneBlock} from './keccak'
export type Affine={x:bigint,y:bigint}
export type JacobianPoint={x:bigint,y:bigint,z:bigint}
export type ScalarSignature={r:bigint,s:bigint}

/** Experimental a=0 Jacobian arithmetic; EFD dbl-2009-l / madd-2007-bl. */
export class JacobianECDSA extends SmartContractLib{
 @prop() static readonly P:bigint=0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2fn
 @prop() static readonly N:bigint=0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n
 @prop() static readonly GX:bigint=55066263022277343669578718895168534326250603453777594175500187360389116729240n
 @prop() static readonly GY:bigint=32670510020758816978083085130507043184471273380659243275938904335757337482424n
 @method() static mod(v:bigint):bigint{const r=v%JacobianECDSA.P;return r<0n?r+JacobianECDSA.P:r}
 @method() static double(a:JacobianPoint):JacobianPoint{
  let out:JacobianPoint={x:0n,y:1n,z:0n}
  if(a.z!==0n&&a.y!==0n){
   const aa=JacobianECDSA.mod(a.x*a.x)
   const b=JacobianECDSA.mod(a.y*a.y)
   const c=JacobianECDSA.mod(b*b)
   const d=JacobianECDSA.mod(2n*(JacobianECDSA.mod((a.x+b)*(a.x+b))-aa-c))
   const e=JacobianECDSA.mod(3n*aa)
   const f=JacobianECDSA.mod(e*e)
   const x=JacobianECDSA.mod(f-2n*d)
   out={x,y:JacobianECDSA.mod(e*(d-x)-8n*c),z:JacobianECDSA.mod(2n*a.y*a.z)}
  }
  return out
 }
 @method() static mixedAdd(a:JacobianPoint,b:Affine):JacobianPoint{
  let out:JacobianPoint={x:b.x,y:b.y,z:1n}
  if(a.z!==0n){
   const zz=JacobianECDSA.mod(a.z*a.z)
   const u=JacobianECDSA.mod(b.x*zz)
   const s=JacobianECDSA.mod(b.y*a.z*zz)
   const h=JacobianECDSA.mod(u-a.x)
   const hh=JacobianECDSA.mod(h*h)
   if(h===0n){
    if(s===a.y)out=JacobianECDSA.double(a)
    else out={x:0n,y:1n,z:0n}
   }else{
    const i=JacobianECDSA.mod(4n*hh)
    const j=JacobianECDSA.mod(h*i)
    const r=JacobianECDSA.mod(2n*(s-a.y))
    const v=JacobianECDSA.mod(a.x*i)
    const x=JacobianECDSA.mod(r*r-j-2n*v)
    out={x,y:JacobianECDSA.mod(r*(v-x)-2n*a.y*j),z:JacobianECDSA.mod((a.z+h)*(a.z+h)-zz-hh)}
   }
  }
  return out
 }
 @method() static verify(hashInt:bigint,sig:ScalarSignature,q:Affine,sInverse:bigint,jointLambda:bigint):boolean{
  assert(sig.r>0n&&sig.r<JacobianECDSA.N&&sig.s>0n&&sig.s<JacobianECDSA.N,'r/s out of range')
  assert(sInverse>0n&&sInverse<JacobianECDSA.N&&(sInverse*sig.s)%JacobianECDSA.N===1n,'inverse witness invalid')
  assert(q.x>=0n&&q.x<JacobianECDSA.P&&q.y>=0n&&q.y<JacobianECDSA.P&&JacobianECDSA.mod(q.y*q.y)===JacobianECDSA.mod(q.x*q.x*q.x+7n),'pinned public key not on curve')
  assert(hashInt>=0n&&hashInt<0x10000000000000000000000000000000000000000000000000000000000000000n,'digest out of range')
  assert(jointLambda>=0n&&jointLambda<JacobianECDSA.P,'joint witness range')
  const jointInfinity=q.x===JacobianECDSA.GX&&q.y!==JacobianECDSA.GY
  let joint:Affine={x:0n,y:0n}
  if(!jointInfinity){
   const same=q.x===JacobianECDSA.GX
   const numerator=same?JacobianECDSA.mod(3n*q.x*q.x):JacobianECDSA.mod(q.y-JacobianECDSA.GY)
   const denominator=same?JacobianECDSA.mod(2n*q.y):JacobianECDSA.mod(q.x-JacobianECDSA.GX)
   assert(JacobianECDSA.mod(jointLambda*denominator)===numerator,'joint slope witness invalid')
   const x=JacobianECDSA.mod(jointLambda*jointLambda-JacobianECDSA.GX-q.x)
   joint={x,y:JacobianECDSA.mod(jointLambda*(JacobianECDSA.GX-x)-JacobianECDSA.GY)}
  }
  let u1=(hashInt*sInverse)%JacobianECDSA.N
  let u2=(sig.r*sInverse)%JacobianECDSA.N
  let bit:bigint=0x8000000000000000000000000000000000000000000000000000000000000000n
  let acc:JacobianPoint={x:0n,y:1n,z:0n}
  for(let i=0;i<256;i++){
   acc=JacobianECDSA.double(acc)
   const one=u1>=bit
   const two=u2>=bit
   if(one)u1-=bit
   if(two)u2-=bit
   let selected:Affine={x:JacobianECDSA.GX,y:JacobianECDSA.GY}
   if(two)selected=q
   if(one&&two)selected=joint
   if((one||two)&&!(one&&two&&jointInfinity))acc=JacobianECDSA.mixedAdd(acc,selected)
   bit/=2n
  }
  const zz=JacobianECDSA.mod(acc.z*acc.z)
  return acc.z!==0n&&(acc.x===JacobianECDSA.mod(sig.r*zz)||(sig.r+JacobianECDSA.N<JacobianECDSA.P&&acc.x===JacobianECDSA.mod((sig.r+JacobianECDSA.N)*zz)))
 }
}

/** Crypto-only comparison: original raw UTF-8 is hashed inside Script; no payout authority. */
export class AirnodeJacobian extends SmartContract{
 @prop() requestHash:ByteString
 @prop() publicKey:Affine
 @prop() validFrom:bigint
 @prop() validTo:bigint
 constructor(requestHash:ByteString,publicKey:Affine,validFrom:bigint,validTo:bigint){super(...arguments);this.requestHash=requestHash;this.publicKey=publicKey;this.validFrom=validFrom;this.validTo=validTo}
 @method() public unlock(timestamp:bigint,data:ByteString,sig:ScalarSignature,sInverse:bigint,jointLambda:bigint){
  assert(timestamp>=this.validFrom&&timestamp<=this.validTo,'outside immutable signing window')
  const inner=KeccakOneBlock.digest(this.requestHash+reverseByteString(Utils.toLEUnsigned(timestamp,32n),32n)+data)
  const digest=KeccakOneBlock.digest(toByteString('19457468657265756d205369676e6564204d6573736167653a0a3332')+inner)
  assert(JacobianECDSA.verify(Utils.fromLEUnsigned(reverseByteString(digest,32n)),sig,this.publicKey,sInverse,jointLambda),'original EIP191 signature mismatch')
 }
}
