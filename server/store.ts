import fs from 'node:fs';
import path from 'node:path';
import {local} from './config.js';
export type TxRecord={label:string,role:string,hash:`0x${string}`,raw?:`0x${string}`,status:string,url:string,gasPaidWei?:string,maxGasWei?:string,estimatedL1FeeWei?:string,l2GasPaidWei?:string,l1FeePaidWei?:string,operatorFeePaidWei?:string,feeAccounting?:string,receipt?:any};
export type Job={id:string,proposalId:string,proposal:any,status:string,stage:string,marketId?:string,mandateId:`0x${string}`,intentId:`0x${string}`,transactions:TxRecord[],events:any[],error?:string,createdAt:number};
export type State={proposals:any[],jobs:Job[],evidence:any[],health:any};
export function createStore(file:string){
 fs.mkdirSync(path.dirname(file),{recursive:true});
 const state:State=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{proposals:[],jobs:[],evidence:[],health:{}};
 function save(){const tmp=file+'.tmp'; fs.writeFileSync(tmp,JSON.stringify(state,(_,v)=>typeof v==='bigint'?v.toString():v,2),{mode:0o600});fs.renameSync(tmp,file);}
 function event(job:Job,type:string,message:string){job.events.push({at:Math.floor(Date.now()/1000),type,message});save();}
 return {state,save,event};
}
export const {state,save,event}=createStore(path.join(local,'state.json'));
export function publicJob(job:Job){return {...job,transactions:job.transactions.map(({raw,receipt,...t})=>t)};}
