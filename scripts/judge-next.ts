/**
 * V2 judge tamper test — read-only. No wallet, no signature, no transaction, no gas.
 *
 * Replays `settle(marketId,timestamp,data,signature)` with eth_call against the deployed
 * Base Sepolia FactMarketNext at a historical block where ETH/USD market 1 was still open,
 * matched and inside its observation window (the block just before its real settlement).
 * The deployed contract code decides; this script only decodes its answer.
 *
 *   npx tsx scripts/judge-next.ts --case valid --save valid.json   # extract the real accepted response
 *   # edit one value in valid.json, re-sign it with your own key, or swap in another response, then:
 *   npx tsx scripts/judge-next.ts --file valid.json
 *   npx tsx scripts/judge-next.ts --case edited-value              # recorded rejected inputs:
 *                                   # stale-real-response | different-request | wrong-signer
 *
 * A live transaction route also exists: the /next Evidence form or POST /api/next/markets/:id/submit
 * on a fresh open market, or a direct `settle` call from your own Base Sepolia test wallet.
 */
import fs from 'node:fs';
import {BaseError,ContractFunctionRevertedError,createPublicClient,decodeFunctionData,fromHex,http,toHex,type Hex} from 'viem';
import {baseSepolia} from 'viem/chains';

const load=(file:string)=>JSON.parse(fs.readFileSync(file,'utf8'));
const abi=load('docs/FactMarketNext.abi.json');
const deployment=load('docs/evidence/v2/deployment.json');
const evidence=load('docs/evidence/v2/verification-public.json');
const arg=(name:string)=>{const i=process.argv.indexOf('--'+name);return i>0?process.argv[i+1]:undefined;};

// Market 1 (ETH/USD) settled in block 52479898; the four tamper receipts are in blocks 52479836–52479869.
const marketId=BigInt(arg('market')??'1');
const blockNumber=BigInt(arg('block')??'52479897');
const client=createPublicClient({chain:baseSepolia,transport:http(process.env.RPC_URL||'https://sepolia.base.org',{timeout:20000,retryCount:3})});

type Envelope={timestamp:string,data:string,signature:Hex};
const cases:Record<string,Hex>={valid:evidence.feeds.find((f:any)=>f.marketId==='1').settlement};
for(const c of evidence.cases)if(c.marketId==='1')cases[c.name]=c.transaction;

async function fromTransaction(hash:Hex):Promise<Envelope>{
 const tx=await client.getTransaction({hash});
 const {functionName,args}=decodeFunctionData({abi,data:tx.input});
 if(functionName!=='settle')throw Error(`${hash} is not a settle call`);
 const [,timestamp,data,signature]=args as [bigint,bigint,Hex,Hex];
 return {timestamp:timestamp.toString(),data:fromHex(data,'string'),signature};
}

const name=arg('case'),file=arg('file');
if(!name&&!file)throw Error(`Usage: npx tsx scripts/judge-next.ts (--case ${Object.keys(cases).join('|')} | --file envelope.json) [--save out.json] [--block N] [--market ID]`);
if(name&&!cases[name])throw Error(`Unknown case. Use one of: ${Object.keys(cases).join(', ')}`);
const envelope:Envelope=file?load(file):await fromTransaction(cases[name!]);
if(typeof envelope.data!=='string'||!/^\d+$/.test(String(envelope.timestamp))||!/^0x[\da-fA-F]{130}$/.test(envelope.signature))
 throw Error('Envelope needs {"timestamp":"<seconds>","data":"<original signed JSON string>","signature":"0x<65 bytes>"}');
const save=arg('save');if(save)fs.writeFileSync(save,JSON.stringify(envelope,null,2)+'\n');

const block=await client.getBlock({blockNumber});
console.log(`Contract ${deployment.market} (Base Sepolia 84532), market ${marketId}, block ${blockNumber} at ${new Date(Number(block.timestamp)*1000).toISOString()}`);
console.log(`Envelope ${name?`case "${name}"`:file}: timestamp ${envelope.timestamp}, data ${envelope.data}`);
try{
 await client.simulateContract({account:'0x000000000000000000000000000000000000dEaD',address:deployment.market,abi,functionName:'settle',
  args:[marketId,BigInt(envelope.timestamp),toHex(envelope.data),envelope.signature],blockNumber});
 console.log('ACCEPTED — the contract would settle this market from this response.');
}catch(e){
 const revert=e instanceof BaseError?e.walk(x=>x instanceof ContractFunctionRevertedError):undefined;
 if(!(revert instanceof ContractFunctionRevertedError))throw e;
 console.log(`REJECTED — ${revert.data?.errorName??'unknown error'}${revert.data?.args?.length?` ${JSON.stringify(revert.data.args)}`:''}. No state change.`);
 process.exitCode=1;
}
