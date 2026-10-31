import fs from 'node:fs';
import {publicClient} from '../server/config.js';
import {receiptFeeBreakdown} from '../server/transactions.js';
async function fees(hash:`0x${string}`){const raw:any=await publicClient.request({method:'eth_getTransactionReceipt',params:[hash]});if(!raw)throw Error('Missing fee receipt');return receiptFeeBreakdown(raw);}
for(const file of ['docs/evidence/deployment.json','docs/evidence/chain-smoke.json','docs/evidence/agent-runs.json']){
 if(!fs.existsSync(file))continue;const report=JSON.parse(fs.readFileSync(file,'utf8'));
 async function walk(x:any):Promise<void>{if(!x||typeof x!=='object')return;const hash=x.hash||x.tx;if(typeof hash==='string'&&/^0x[\da-f]{64}$/i.test(hash)&&(x.gasPaidWei!==undefined||x.status==='reverted'||x.status==='confirmed'||x.blockNumber))Object.assign(x,await fees(hash as `0x${string}`));for(const [k,v]of Object.entries(x))if(k!=='receipt')if(Array.isArray(v)){for(const i of v)await walk(i);}else if(v&&typeof v==='object')await walk(v);}
 await walk(report);report.feeReconciledAt=new Date().toISOString();fs.writeFileSync(file,JSON.stringify(report,null,2)+'\n');console.log(`${file}: receipt fees reconciled`);
}
