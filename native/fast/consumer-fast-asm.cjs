/* Experimental local spike helper; no wallet, key access, funding or broadcasting. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),zlib=require('node:zlib')
const {buildContractClass,Bytes,Int,SigHashPreimage,Ripemd160,bsv}=require('scryptlib')
const {publicKeyToAddress}=require('viem/accounts')
const artifactPath=path.join(__dirname,'artifacts/nodary-fast-asm.json')
const artifactText=fs.existsSync(artifactPath)?fs.readFileSync(artifactPath,'utf8'):zlib.gunzipSync(fs.readFileSync(artifactPath+'.gz')).toString('utf8')
const artifact=JSON.parse(artifactText)
const Consumer=buildContractClass(artifact)
const P=0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2fn,N=0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n,GX=55066263022277343669578718895168534326250603453777594175500187360389116729240n,GY=32670510020758816978083085130507043184471273380659243275938904335757337482424n
const mod=(v,p)=>(v%p+p)%p
function inverse(v,p){let a=mod(v,p),b=p,x=1n,y=0n;while(b){const q=a/b;[a,b]=[b,a-q*b];[x,y]=[y,x-q*y]}if(a!==1n)throw Error('Not invertible');return mod(x,p)}
function arithmeticHints(key,s){const qx=BigInt('0x'+key.slice(2,66)),qy=BigInt('0x'+key.slice(66,130));return{sInverse:inverse(s,N),jointLambda:qx===GX&&qy!==GY?0n:mod((qx===GX?3n*qx*qx:qy-GY)*inverse(qx===GX?2n*qy:qx-GX,P),P)}}
const strip=v=>String(v).replace(/^0x/,'')
const bytes=v=>Bytes(strip(v))
const number=v=>Int(BigInt(v))
const sha=hex=>crypto.createHash('sha256').update(Buffer.from(hex,'hex')).digest('hex')

/** Inputs are PUBLIC policy. Recipients must be actual wallet-derived locking scripts. */
function createNodaryFastAsm(policy){
 const key=strip(policy.airnodePublicKey)
 if(!/^04[0-9a-fA-F]{128}$/.test(key))throw Error('Expected full uncompressed original Airnode public key')
 const mapped=publicKeyToAddress('0x'+key)
 if(mapped.toLowerCase()!==policy.expectedAirnodeAddress.toLowerCase())throw Error('Original public key does not map to pinned official address')
 if(!/^[0-9a-fA-F]{64}$/.test(strip(policy.requestHash)))throw Error('Expected exact 32-byte request hash')
 const point={x:number('0x'+key.slice(2,66)),y:number('0x'+key.slice(66,130))}
 if(BigInt(policy.buyerStakeSatoshis)<=0n||BigInt(policy.buyerStakeSatoshis)>=BigInt(policy.collateralSatoshis))throw Error('This paired-pool prototype requires two nonzero fixed refund shares')
 const c=new Consumer(bytes(policy.requestHash),point,number(policy.validFrom),number(policy.validTo),number(policy.threshold18),number(policy.collateralSatoshis),bytes(policy.yesRecipientScript),bytes(policy.noRecipientScript),number(policy.refundAfter),bytes(policy.refundBuyerScript),bytes(policy.refundCounterpartyScript),number(policy.buyerStakeSatoshis))
 const lockingHex=c.lockingScript.toHex()
 const postSeparatorScriptHex=c.lockingScript.subScript(0).toHex()
 return {
  lockingHex,postSeparatorScriptHex,
  info:{scope:'experimental NEW optimized ASM native original-Airnode outcome guard; not deployed by this helper',originalSigner:mapped,lockingScriptBytes:lockingHex.length/2,nonPushOpcodes:c.lockingScript.chunks.filter(x=>x.opcodenum>96).length,postSeparatorScriptBytes:postSeparatorScriptHex.length/2,lockingScriptSha256:sha(lockingHex),artifactSha256:crypto.createHash('sha256').update(artifactText).digest('hex'),timing:'fixed signed/source observation window; no current-block timestamp; mature refund and valid settlement race for same UTXO'},
  /** Compute preimage from ACTUAL tx and postSeparatorScriptHex with SIGHASH_ALL|FORKID=0x41. */
  unlock({refund=false,envelope,preimageHex,changeAmount=0n,changePublicKeyHash='00'.repeat(20)}){
   let t=0n,data='',r=0n,s=0n,sInverse=0n,jointLambda=0n
   if(!refund){
    if(!envelope||envelope.requestHash.toLowerCase()!==policy.requestHash.toLowerCase())throw Error('Envelope request mismatch')
    t=BigInt(envelope.timestamp);data=Buffer.from(envelope.data,'utf8').toString('hex')
    const signature=strip(envelope.signature);if(!/^[0-9a-fA-F]{130}$/.test(signature))throw Error('Expected original 65-byte EIP191 signature')
    r=BigInt('0x'+signature.slice(0,64));s=BigInt('0x'+signature.slice(64,128));({sInverse,jointLambda}=arithmeticHints(key,s))
   }
   const call=c.spend(!!refund,number(t),Bytes(data),{r:number(r),s:number(s)},number(sInverse),number(jointLambda),SigHashPreimage(strip(preimageHex)),number(changeAmount),Ripemd160(strip(changePublicKeyHash)))
   return call.toScript().toHex()
  },
  // Local direct interpreter only; app production must use its pinned SDK actual transaction.
  _delegate:c,
 }
}
function verifyRaw({policy,rawTransaction,inputIndex=0,sourceSatoshis}){
 if(typeof rawTransaction!=='string'||!/^(?:[0-9a-fA-F]{2})+$/.test(rawTransaction))throw Error('Standard signed raw transaction hex required')
 const tx=new bsv.Transaction(rawTransaction),amount=Number(sourceSatoshis)
 if(tx.toString()!==rawTransaction.toLowerCase()||!Number.isSafeInteger(inputIndex)||inputIndex<0||inputIndex>=tx.inputs.length||!Number.isSafeInteger(amount)||amount<=0||BigInt(amount)!==BigInt(policy.collateralSatoshis))throw Error('Noncanonical raw/context or wrong protected amount')
 const guard=createNodaryFastAsm(policy),started=Date.now()
 const result=guard._delegate.run_verify(tx.inputs[inputIndex].script,{tx,inputIndex,inputSatoshis:amount})
 return{...result,elapsedMs:Date.now()-started,scope:'local compiled VM only; node execution policy and network acceptance require separate evidence'}
}
module.exports={createNodaryFastAsm,arithmeticHints,verifyRaw}
