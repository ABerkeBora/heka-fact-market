import {acquireProcessLock} from '../server/lock.js';
import fs from 'node:fs';
import path from 'node:path';
import {keccak256,type Hex} from 'viem';
import {artifact,local,publicClient,wallet} from '../server/config.js';
acquireProcessLock('deployment');
const file=path.join(local,'deployment.json');
const d:any=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{network:'Base Sepolia',chainId:84532,deployer:wallet('deployer').account.address,transactions:{}};
const save=()=>fs.writeFileSync(file,JSON.stringify(d,(_,v)=>typeof v==='bigint'?v.toString():v,2),{mode:0o600});
for(const name of ['TestCollateral','FactMarket']){
 const key=name==='TestCollateral'?'collateral':'market'; if(d[key])continue;
 const a=artifact(name),client=wallet('deployer');
 let tx=d.transactions[key];
 if(!tx){
  const {encodeDeployData}=await import('viem');
  const data=encodeDeployData({abi:a.abi,bytecode:a.bytecode.object as Hex,args:key==='market'?[d.collateral]:[]});
  const gas=await publicClient.estimateGas({account:client.account,data});
  const prepared=await client.prepareTransactionRequest({account:client.account,data,gas:gas*12n/10n});
  const raw=await client.signTransaction(prepared);tx={hash:keccak256(raw),raw};d.transactions[key]=tx;save();
 }
 let receipt;try{receipt=await publicClient.getTransactionReceipt({hash:tx.hash});}catch{}
 if(!receipt){try{await publicClient.sendRawTransaction({serializedTransaction:tx.raw});}catch(e:any){if(!/already known|nonce too low/i.test(e.message))throw e;}receipt=await publicClient.waitForTransactionReceipt({hash:tx.hash,timeout:60000});}
 if(receipt.status!=='success')throw Error(`${name} deployment reverted`);
 d[key]=receipt.contractAddress;tx.blockNumber=receipt.blockNumber.toString();tx.gasPaidWei=(receipt.gasUsed*receipt.effectiveGasPrice).toString();delete tx.raw;save();console.log(`${name} deployed ${d[key]} https://sepolia.basescan.org/tx/${tx.hash}`);
}
fs.mkdirSync('docs/evidence',{recursive:true});fs.writeFileSync('docs/evidence/deployment.json',JSON.stringify(d,null,2)+'\n');
