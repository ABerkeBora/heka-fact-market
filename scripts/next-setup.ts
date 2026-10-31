import fs from 'node:fs';
import path from 'node:path';
import {generatePrivateKey,privateKeyToAccount} from 'viem/accounts';
import {encodeDeployData,keccak256,type Hex,type Address} from 'viem';
import {acquireProcessLock} from '../server/lock.js';
import {artifact,publicClient,wallet,type Role} from '../server/config.js';
import {nextLocal,nextWallet,nextDeployment} from '../server/next/context.js';
acquireProcessLock('V2 isolated test-role setup/deployment');
if(await publicClient.getChainId()!==84532)throw Error('Only Base Sepolia');
const walletFile=process.env.NEXT_WALLET_FILE||path.join(nextLocal,'test-wallets.json');
if(!fs.existsSync(walletFile)){
 const roles:any={};for(const r of ['deployer','buyer','counterparty']){const privateKey=generatePrivateKey();roles[r]={address:privateKeyToAccount(privateKey).address,privateKey};}
 fs.writeFileSync(walletFile,JSON.stringify({testOnly:true,chainId:84532,namespace:'fact-market-next',roles},null,2),{mode:0o600});
}
const journalFile=path.join(nextLocal,'setup-intents.json');
const journal:any=fs.existsSync(journalFile)?JSON.parse(fs.readFileSync(journalFile,'utf8')):{scope:{chainId:84532,asset:'testETH',maxFundingPerRoleWei:'500000000000000',maxFundingTotalWei:'1500000000000000',allowedRecipients:['deployer','buyer','counterparty'].map(r=>nextWallet(r as Role).account.address),automaticTopUp:false},transactions:{}};
const save=()=>fs.writeFileSync(journalFile,JSON.stringify(journal,(_,v)=>typeof v==='bigint'?v.toString():v,2),{mode:0o600});
async function send(key:string,client:ReturnType<typeof wallet>,input:{to?:Address,data?:Hex,value?:bigint}){
 let tx=journal.transactions[key];
 if(!tx){const gas=await publicClient.estimateGas({account:client.account,...input});const prepared=await client.prepareTransactionRequest({account:client.account,...input,gas:gas*12n/10n});if((prepared.maxFeePerGas||0n)*(prepared.gas||0n)>50000000000000n)throw Error('Setup execution gas exceeds cap');const raw=await client.signTransaction(prepared);tx={hash:keccak256(raw),raw};journal.transactions[key]=tx;save();}
 let receipt;try{receipt=await publicClient.getTransactionReceipt({hash:tx.hash});}catch{}
 if(!receipt){try{await publicClient.sendRawTransaction({serializedTransaction:tx.raw});}catch(e:any){if(!/already known|nonce too low/i.test(e.message))throw e;}receipt=await publicClient.waitForTransactionReceipt({hash:tx.hash,timeout:60000});}
 if(receipt.status!=='success')throw Error('Setup transaction reverted; no new signature created');
 tx.blockNumber=receipt.blockNumber.toString();tx.status='confirmed';tx.url=`https://sepolia.basescan.org/tx/${tx.hash}`;save();return receipt;
}
for(const role of ['deployer','buyer','counterparty'] as const){
 const address=nextWallet(role).account.address;
 if(address.toLowerCase()===wallet(role).account.address.toLowerCase())throw Error('V1/V2 role address overlap');
 const key='initial-test-gas:'+role;
 if(!journal.transactions[key]&&await publicClient.getBalance({address})>0n){journal.transactions[key]={status:'preexisting-balance',address};save();continue;}
 if(journal.transactions[key]?.status==='preexisting-balance')continue;
 await send(key,wallet('deployer'),{to:address,value:500000000000000n});
 console.log(`Isolated V2 ${role} initial test gas confirmed`);
}
const deploymentFile=path.join(nextLocal,'deployment.json');const d:any=nextDeployment()||{version:'next',network:'Base Sepolia',chainId:84532,deployer:nextWallet('deployer').account.address,transactions:{}};
for(const [key,name]of [['collateral','TestCollateral'],['market','FactMarketNext']]){
 if(d[key])continue;const a=artifact(name);
 const data=encodeDeployData({abi:a.abi,bytecode:a.bytecode.object,args:key==='market'?[d.collateral]:[]});
 const receipt=await send('deploy:'+key,nextWallet('deployer'),{data});d[key]=receipt.contractAddress;const tx=journal.transactions['deploy:'+key];const {raw,...publicTx}=tx;d.transactions[key]=publicTx;
 fs.writeFileSync(deploymentFile,JSON.stringify(d,null,2),{mode:0o600});console.log(`V2 ${name}: ${d[key]}`);
}
const publicSetup={...d,roleAddresses:Object.fromEntries((['deployer','buyer','counterparty']as const).map(r=>[r,nextWallet(r).account.address])),initialFunding:Object.fromEntries(Object.entries(journal.transactions).filter(([k])=>k.startsWith('initial-test-gas:')).map(([k,v]:[string,any])=>{const {raw,...safe}=v;return[k,safe];})),fundingScope:journal.scope,setupIsNotCustomerPayment:true};
fs.writeFileSync('docs/evidence/v2/deployment.json',JSON.stringify(publicSetup,null,2)+'\n');
