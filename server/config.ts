import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import {createPublicClient, createWalletClient, http, type Hex} from 'viem';
import {privateKeyToAccount} from 'viem/accounts';
import {baseSepolia} from 'viem/chains';
export const root = process.cwd();
export const local = path.join(root,'.local');
fs.mkdirSync(local,{recursive:true});
export const rpcUrl=process.env.RPC_URL || 'https://sepolia.base.org';
export const publicClient=createPublicClient({chain:baseSepolia,transport:http(rpcUrl,{timeout:20000,retryCount:1})});
export type Role='deployer'|'buyer'|'counterparty';
export function assertPrivateWalletLocation(file:string){const resolved=path.resolve(file);if(resolved.startsWith(root+path.sep)&&!resolved.startsWith(local+path.sep))throw Error('Wallet files inside this checkout must be stored under ignored .local/');}
for(const file of [process.env.WALLET_FILE||path.join(local,'test-wallets.json'),process.env.NEXT_WALLET_FILE||path.join(local,'next','test-wallets.json')])assertPrivateWalletLocation(file);
export function wallet(role:Role) {return walletFromFile(process.env.WALLET_FILE || path.join(local,'test-wallets.json'),role);}
export function walletFromFile(walletFile:string,role:Role) {
 assertPrivateWalletLocation(walletFile);
 const st=fs.statSync(walletFile); if((st.mode & 0o077)!==0) throw Error('Wallet file must have mode 0600');
 const w=JSON.parse(fs.readFileSync(walletFile,'utf8'));
 if(w.testOnly!==true || Number(w.chainId)!==84532) throw Error('Test-only Base Sepolia wallet required');
 const r=w.roles?.[role]; if(!r?.privateKey) throw Error(`Missing ${role} test role`);
 const account=privateKeyToAccount(r.privateKey as Hex); if(account.address.toLowerCase()!==r.address.toLowerCase()) throw Error('Role address mismatch');
 return createWalletClient({account,chain:baseSepolia,transport:http(rpcUrl,{timeout:20000,retryCount:0})});
}
export function artifact(name:string) {return JSON.parse(fs.readFileSync(path.join(root,`out/${name}.sol/${name}.json`),'utf8'));}
export function deployment() {const p=path.join(local,'deployment.json'); return fs.existsSync(p)?JSON.parse(fs.readFileSync(p,'utf8')):null;}
