import {SmartContract, prop, method, ByteString, assert, Utils, reverseByteString, toByteString} from 'scrypt-ts'
import {SECP256K1, Point, Signature} from 'scrypt-ts-lib'
import {KeccakOneBlock} from './keccak'

/** CRYPTO SPIKE ONLY. No payout, wallet, current-block freshness or JSON parser. */
export class AirnodeNative extends SmartContract {
 @prop() requestHash: ByteString
 @prop() airnodePublicKey: Point
 @prop() validFrom: bigint
 @prop() validTo: bigint
 constructor(requestHash: ByteString, airnodePublicKey: Point, validFrom: bigint, validTo: bigint){super(...arguments);this.requestHash=requestHash;this.airnodePublicKey=airnodePublicKey;this.validFrom=validFrom;this.validTo=validTo}
 @method() public unlock(timestamp: bigint, data: ByteString, signature: Signature){
  assert(timestamp>=this.validFrom && timestamp<=this.validTo,'outside pinned signature window')
  const packed=this.requestHash+reverseByteString(Utils.toLEUnsigned(timestamp,32n),32n)+data
  const inner=KeccakOneBlock.digest(packed)
  const prefixed=toByteString('19457468657265756d205369676e6564204d6573736167653a0a3332')+inner
  const digest=KeccakOneBlock.digest(prefixed)
  const hashInt=Utils.fromLEUnsigned(reverseByteString(digest,32n))
  assert(SECP256K1.verifySig(hashInt,signature,this.airnodePublicKey),'original Airnode EIP191 signature mismatch')
 }
}
