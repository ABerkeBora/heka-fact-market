import {acquireProcessLock} from '../server/lock.js';
import fs from 'node:fs';
import {toHex} from 'viem';
import {artifact,deployment} from '../server/config.js';
import {state,type Job,publicJob} from '../server/store.js';
import {transact} from '../server/transactions.js';
// Deliberately bypasses off-chain signature checks so the deployed contract is the authority.
acquireProcessLock('judge submit');
const [id,file]=process.argv.slice(2);if(!id||!file)throw Error('Usage: npm run judge:submit -- MARKET_ID response.json');
const e=JSON.parse(fs.readFileSync(file,'utf8')),d=deployment();
const j=state.jobs.find(j=>j.marketId===id);if(!j)throw Error('Use the market job on this local instance, or call the contract directly using its public ABI');
await transact(j,'judge-file:'+Date.now(),'deployer',d.market,artifact('FactMarket').abi,'settle',[BigInt(id),BigInt(e.timestamp),toHex(e.data),e.signature]);
console.log(JSON.stringify(publicJob(j),null,2));
