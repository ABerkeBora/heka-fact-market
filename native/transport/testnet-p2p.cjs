/* Outbound-only BSV testnet transport. Never signs, creates transactions, or reads keys. */
'use strict'
const net=require('node:net'),crypto=require('node:crypto')
const {Transaction}=require('@bsv/sdk')
const PEER=Object.freeze({host:'bsva-ovh-seed-testnet-us-1.bsvb.tech',port:18333,source:'https://arcade-v2-testnet-us-1.bsvblockchain.tech/health'})
const MAGIC=Buffer.from('f4e5f3f4','hex'),MAX_RX=16*1024*1024,MAX_TOTAL_RX=64*1024*1024
const sha=b=>crypto.createHash('sha256').update(b).digest(),hash=b=>sha(sha(b))
const u32=n=>{const b=Buffer.alloc(4);b.writeUInt32LE(n);return b}
const u64=n=>{const b=Buffer.alloc(8);b.writeBigUInt64LE(BigInt(n));return b}
function compact(n){if(n<253)return Buffer.from([n]);if(n<=65535){const b=Buffer.alloc(3);b[0]=253;b.writeUInt16LE(n,1);return b}return Buffer.concat([Buffer.from([254]),u32(n)])}
function readCompact(b,p=0){if(p>=b.length)throw Error('Truncated compact integer');if(b[p]<253)return[b[p],p+1];if(b[p]===253)return[b.readUInt16LE(p+1),p+3];if(b[p]===254)return[b.readUInt32LE(p+1),p+5];const n=b.readBigUInt64LE(p+1);if(n>BigInt(Number.MAX_SAFE_INTEGER))throw Error('Oversized compact integer');return[Number(n),p+9]}
function varstr(s){const b=Buffer.from(s);return Buffer.concat([compact(b.length),b])}
function frame(command,payload=Buffer.alloc(0)){const h=Buffer.alloc(24);MAGIC.copy(h);h.write(command,4,'ascii');h.writeUInt32LE(payload.length,16);hash(payload).copy(h,20,0,4);return Buffer.concat([h,payload])}
function version(){const addr=Buffer.alloc(26);addr.writeUInt16BE(PEER.port,24);return Buffer.concat([u32(70016),u64(0),u64(Math.floor(Date.now()/1000)),addr,Buffer.alloc(26),crypto.randomBytes(8),varstr('/HekaTestnetTransport:0.2/'),u32(0),Buffer.from([0])])}
function inventory(ids){return Buffer.concat([compact(ids.length),...ids.map(id=>Buffer.concat([u32(1),Buffer.from(id,'hex').reverse()]))])}
function readInventory(payload){const[n,start]=readCompact(payload);if(n>50000||start+n*36!==payload.length)throw Error('Invalid/bounded inventory length');const items=[];for(let p=start;p<payload.length;p+=36)items.push({type:payload.readUInt32LE(p),txid:Buffer.from(payload.subarray(p+4,p+36)).reverse().toString('hex')});return items}
function rejectDetails(payload){const[n,p]=readCompact(payload);const command=payload.subarray(p,p+n).toString('ascii'),code=payload[p+n];const[m,q]=readCompact(payload,p+n+1),reason=payload.subarray(q,q+m).toString('utf8'),rest=payload.subarray(q+m);return{command,code,reason,txid:rest.length===32?Buffer.from(rest).reverse().toString('hex'):undefined}}

/** Call only with public, already-signed bytes frozen in this project's journal. Never expose this as an LLM arbitrary-transaction tool. */
function validateCanonical({network,expectedTxid,rawHex,parentRawHexes=[]}){
 if(network!=='testnet')throw Error('This transport is BSV testnet only')
 if(!/^[0-9a-fA-F]{64}$/.test(expectedTxid||''))throw Error('Explicit frozen canonical txid required')
 if(!Array.isArray(parentRawHexes)||parentRawHexes.length>128)throw Error('Bounded public ancestor list required')
 const txs=new Map()
 let totalBytes=0
 for(const hex of [...parentRawHexes,rawHex]){
  if(typeof hex!=='string'||!/^(?:[0-9a-fA-F]{2})+$/.test(hex)||hex.length/2>MAX_RX)throw Error('Canonical/ancestor raw must be bounded standard raw hex, not EF/BEEF')
  totalBytes+=hex.length/2;if(totalBytes>MAX_TOTAL_RX)throw Error('Total public transaction byte budget exceeded')
  const tx=Transaction.fromHex(hex),id=tx.id('hex'),raw=Buffer.from(hex,'hex')
  if(hash(raw).reverse().toString('hex')!==id)throw Error('Raw serialization/hash mismatch')
  txs.set(id,{raw,parents:tx.inputs.map(i=>i.sourceTXID).filter(Boolean)})
 }
 const expected=expectedTxid.toLowerCase(),canonical=Buffer.from(rawHex,'hex')
 if(hash(canonical).reverse().toString('hex')!==expected)throw Error('Raw bytes differ from the frozen canonical txid')
 const ordered=[],visiting=new Set(),done=new Set()
 function visit(id){if(done.has(id)||!txs.has(id))return;if(visiting.has(id))throw Error('Cyclic supplied ancestry');visiting.add(id);for(const p of txs.get(id).parents)visit(p);visiting.delete(id);done.add(id);ordered.push(id)}
 visit(expected)
 return{expected,canonical,txs,ordered}
}

/** Pure public BEEF extraction; no wallet APIs or signing. Caller supplies only its own frozen public journal's BEEF. */
function rawParentsFromBeef(publicBeef,expectedTxid){
 const tx=Transaction.fromBEEF(Array.isArray(publicBeef)?publicBeef:Buffer.from(publicBeef,'hex'))
 if(tx.id('hex')!==expectedTxid.toLowerCase())throw Error('BEEF root does not match frozen canonical id')
 const out=new Map();function visit(t){for(const i of t.inputs)if(i.sourceTransaction){visit(i.sourceTransaction);out.set(i.sourceTransaction.id('hex'),i.sourceTransaction.toHex())}}
 visit(tx);return [...out.values()]
}

/** mode='broadcast': INV/GETDATA/TX only, no acceptance claim. mode='query': fresh GETDATA only, never sends INV/TX. No MEMPOOL command exists. */
async function transportCanonical(options){
 const {expected,canonical,txs,ordered}=validateCanonical(options),mode=options.mode||'query'
 if(!['query','broadcast'].includes(mode))throw Error('Mode must be query or broadcast')
 const timeoutMs=Math.min(45000,Math.max(3000,options.timeoutMs||35000))
 const result={checkedAt:new Date().toISOString(),network:'BSV testnet',peer:{...PEER},magic:MAGIC.toString('hex'),mode,txid:expected,canonicalBytes:canonical.length,canonicalSha256:sha(canonical).toString('hex'),status:'PENDING',txSent:false,peerReturnedExactCanonical:false,peerAnnouncedCanonical:false,mined:false,events:[]}
 let finished=false,gotVersion=false,gotVerack=false,gotProtoconf=false,peerMax=1024*1024,started=false,totalRx=0,header=Buffer.alloc(0),current=null
 return await new Promise(resolve=>{
  const socket=net.createConnection({host:PEER.host,port:PEER.port})
  const emit=(name,details={})=>{const e={at:new Date().toISOString(),name,...details};result.events.push(e);if(options.onEvent)try{options.onEvent(e)}catch{} }
  const finish=(status,reason)=>{if(finished)return;finished=true;clearTimeout(timer);result.status=status;result.reason=reason;result.finishedAt=new Date().toISOString();emit('finished',{status,reason});socket.destroy();resolve(result)}
  const timer=setTimeout(()=>finish(result.txSent?'SENT_UNCONFIRMED':'UNRESOLVED','Bounded attempt elapsed; no acceptance/mining inferred'),timeoutMs)
  function send(cmd,payload=Buffer.alloc(0)){if(finished)return;socket.write(frame(cmd,payload));emit('sent',{command:cmd,bytes:payload.length})}
  function start(){if(started||!gotVersion||!gotVerack||!gotProtoconf)return;if(canonical.length>peerMax)return finish('PEER_LIMIT_BLOCKED','Canonical bytes exceed advertised peer receive limit');started=true;send(mode==='broadcast'?'inv':'getdata',inventory(mode==='broadcast'?ordered:[expected]))}
  function message(command,payload){
   emit('received',{command,bytes:payload.length})
   if(result.events.length>1000)return finish('BOUNDED_RX_ABORT','Too many peer messages')
   if(command==='version'){
    if(gotVersion||payload.length<86)throw Error('Invalid/repeated version')
    const[n,p]=readCompact(payload,80);if(n>256||p+n+4>payload.length)throw Error('Malformed peer version')
    const peerVersion={protocol:payload.readInt32LE(0),userAgent:payload.subarray(p,p+n).toString(),height:payload.readInt32LE(p+n)}
    if(peerVersion.protocol<70013||!/BSV|Bitcoin SV|BitcoinSV|teranode/i.test(peerVersion.userAgent))throw Error('Verified BSV peer identity not recognized')
    result.peerVersion=peerVersion;gotVersion=true;send('verack');send('protoconf',Buffer.concat([compact(2),u32(MAX_RX),varstr('Default')]))
   }else if(command==='verack'){gotVerack=true
   }else if(command==='protoconf'){const[n,p]=readCompact(payload);if(n<1||p+4>payload.length)throw Error('Invalid protoconf');peerMax=payload.readUInt32LE(p);gotProtoconf=true;result.peerReceiveLimit=peerMax
   }else if(command==='ping'){if(payload.length===8)send('pong',payload)
   }else if(command==='getdata'&&mode==='broadcast'){
    if(!started)throw Error('Unexpected getdata before gated inventory')
    for(const inv of readInventory(payload))if(inv.type===1&&ordered.includes(inv.txid)){const raw=txs.get(inv.txid).raw;if(raw.length>peerMax)throw Error('Ancestor exceeds advertised peer limit');send('tx',raw);if(inv.txid===expected)result.txSent=true;emit('unchanged-tx-sent',{txid:inv.txid,canonical:inv.txid===expected,bytes:raw.length})}
   }else if(command==='tx'&&mode==='query'){
    const id=hash(payload).reverse().toString('hex');if(id!==expected||!payload.equals(canonical))throw Error('Returned transaction differs from frozen canonical bytes')
    result.peerReturnedExactCanonical=true;return finish('RELAY_RETURNED_UNCONFIRMED','Fresh standard GETDATA returned exact bytes; no MEMPOOL request or transaction sent on this connection')
   }else if(command==='inv'){for(const inv of readInventory(payload))if(inv.type===1&&inv.txid===expected)result.peerAnnouncedCanonical=true
   }else if(command==='notfound'&&mode==='query'){if(readInventory(payload).some(i=>i.txid===expected))return finish('PEER_NOT_FOUND','Fresh GETDATA did not find the canonical transaction')
   }else if(command==='reject'){const reject=rejectDetails(payload);emit('peer-reject',reject);if(reject.txid===expected){result.rejection=reject;return finish('PEER_REJECTED',reject.reason)}}
   start()
  }
  socket.on('connect',()=>{emit('connected');send('version',version())})
  socket.on('error',e=>finish(result.txSent?'SENT_UNCONFIRMED':'TRANSPORT_ERROR',e.code||e.message))
  socket.on('close',()=>finish(result.txSent?'SENT_UNCONFIRMED':'UNRESOLVED','Peer closed connection'))
  socket.on('data',chunk=>{
   try{totalRx+=chunk.length;if(totalRx>MAX_TOTAL_RX)throw Error('Total receive budget exceeded');let offset=0
    while(offset<chunk.length&&!finished){
     if(!current){const need=24-header.length,take=Math.min(need,chunk.length-offset);header=Buffer.concat([header,chunk.subarray(offset,offset+take)]);offset+=take;if(header.length<24)continue
      if(!header.subarray(0,4).equals(MAGIC))throw Error('Wrong BSV testnet network magic')
      const length=header.readUInt32LE(16);if(length>MAX_RX)throw Error('Frame exceeds bounded receive limit')
      current={command:header.subarray(4,16).toString('ascii').replace(/\0+$/,''),checksum:Buffer.from(header.subarray(20,24)),payload:Buffer.alloc(length),offset:0};header=Buffer.alloc(0)
     }
     const take=Math.min(current.payload.length-current.offset,chunk.length-offset);chunk.copy(current.payload,current.offset,offset,offset+take);offset+=take;current.offset+=take
     if(current.offset===current.payload.length){const m=current;current=null;if(!hash(m.payload).subarray(0,4).equals(m.checksum))throw Error('Peer message checksum mismatch');message(m.command,m.payload)}
    }
   }catch(e){finish('PROTOCOL_ABORT',e.message)}
  })
 })
}

module.exports={transportCanonical,validateCanonical,rawParentsFromBeef,DEFAULT_TESTNET_PEER:PEER,MAX_RAW_BYTES:MAX_RX}
