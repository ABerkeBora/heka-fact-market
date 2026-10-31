import {SmartContract, SmartContractLib, method, prop, assert, ByteString, FixedArray, fill, len, slice, toByteString, Utils, xor, and, lshift, rshift} from 'scrypt-ts'

/** Experimental one-block Ethereum Keccak, input 0..135 bytes; NOT SHA3 padding. */
export class KeccakOneBlock extends SmartContractLib {
 @prop() static readonly MASK: bigint = 18446744073709551615n
 @prop() static readonly ROT: FixedArray<bigint,25> = [0n,1n,62n,28n,27n,36n,44n,6n,55n,20n,3n,10n,43n,25n,39n,41n,45n,15n,21n,8n,18n,2n,61n,56n,14n]
 @prop() static readonly RC: FixedArray<bigint,24> = [0x0000000000000001n,0x0000000000008082n,0x800000000000808an,0x8000000080008000n,0x000000000000808bn,0x0000000080000001n,0x8000000080008081n,0x8000000000008009n,0x000000000000008an,0x0000000000000088n,0x0000000080008009n,0x000000008000000an,0x000000008000808bn,0x800000000000008bn,0x8000000000008089n,0x8000000000008003n,0x8000000000008002n,0x8000000000000080n,0x000000000000800an,0x800000008000000an,0x8000000080008081n,0x8000000000008080n,0x0000000080000001n,0x8000000080008008n]
 @method() static rot(v: bigint, n: bigint): bigint {
  return and(lshift(v,n),KeccakOneBlock.MASK)+rshift(v,64n-n)
 }
 @method() static digest(input: ByteString): ByteString {
  const size=len(input)
  assert(size<=135n,'one block input limit')
  let padded=toByteString('')
  if(size===135n){padded=input+toByteString('81')}
  else {padded=input+toByteString('01')+Utils.toLEUnsigned(0n,134n-size)+toByteString('80')}
  let a: FixedArray<bigint,25> = fill(0n,25)
  for(let i=0;i<17;i++){a[i]=Utils.fromLEUnsigned(slice(padded,BigInt(i)*8n,BigInt(i+1)*8n))}
  for(let round=0;round<24;round++){
   let c: FixedArray<bigint,5> = fill(0n,5)
   let d: FixedArray<bigint,5> = fill(0n,5)
   for(let x=0;x<5;x++){c[x]=xor(xor(xor(xor(a[x],a[x+5]),a[x+10]),a[x+15]),a[x+20])}
   for(let x=0;x<5;x++){d[x]=xor(c[(x+4)%5],KeccakOneBlock.rot(c[(x+1)%5],1n))}
   for(let y=0;y<5;y++){for(let x=0;x<5;x++){a[x+5*y]=xor(a[x+5*y],d[x])}}
   let b: FixedArray<bigint,25> = fill(0n,25)
   for(let y=0;y<5;y++){for(let x=0;x<5;x++){b[y+5*((2*x+3*y)%5)]=KeccakOneBlock.rot(a[x+5*y],KeccakOneBlock.ROT[x+5*y])}}
   for(let y=0;y<5;y++){for(let x=0;x<5;x++){a[x+5*y]=xor(b[x+5*y],and(xor(KeccakOneBlock.MASK,b[(x+1)%5+5*y]),b[(x+2)%5+5*y]))}}
   a[0]=xor(a[0],KeccakOneBlock.RC[round])
  }
  return Utils.toLEUnsigned(a[0],8n)+Utils.toLEUnsigned(a[1],8n)+Utils.toLEUnsigned(a[2],8n)+Utils.toLEUnsigned(a[3],8n)
 }
}

export class KeccakTest extends SmartContract {
 @prop() expected: ByteString
 constructor(expected: ByteString){super(...arguments);this.expected=expected}
 @method() public unlock(input: ByteString){assert(KeccakOneBlock.digest(input)===this.expected,'Keccak mismatch')}
}
