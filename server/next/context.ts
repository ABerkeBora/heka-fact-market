import fs from 'node:fs';
import path from 'node:path';
import {local,walletFromFile,type Role} from '../config.js';
import {createStore} from '../store.js';
export const nextLocal=path.join(local,'next');fs.mkdirSync(nextLocal,{recursive:true});
export const nextStore=createStore(path.join(nextLocal,'state.json'));
export const nextWallet=(role:Role)=>{
 const file=process.env.NEXT_WALLET_FILE||path.join(nextLocal,'test-wallets.json');const metadata=JSON.parse(fs.readFileSync(file,'utf8'));
 if(metadata.namespace!=='fact-market-next')throw Error('V2 requires its own fact-market-next role namespace');
 const client=walletFromFile(file,role);const v1File=process.env.WALLET_FILE||path.join(local,'test-wallets.json');
 if(fs.existsSync(v1File)){const v1=JSON.parse(fs.readFileSync(v1File,'utf8'));const addresses=Object.values(v1.roles||{}).map((r:any)=>String(r.address).toLowerCase());if(addresses.includes(client.account.address.toLowerCase()))throw Error('V1 and V2 signing roles must be disjoint');}
 const all=['deployer','buyer','counterparty'].map(r=>String(metadata.roles?.[r]?.address).toLowerCase());if(new Set(all).size!==3)throw Error('V2 signing roles must be distinct');
 return client;
};
export const nextDeployment=()=>{const p=path.join(nextLocal,'deployment.json');return fs.existsSync(p)?JSON.parse(fs.readFileSync(p,'utf8')):null;};
