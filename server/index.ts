import {acquireProcessLock} from './lock.js';
import express from 'express';
import fs from 'node:fs';
import {randomBytes} from 'node:crypto';
import {createServer as createViteServer} from 'vite';
import {artifact,deployment,publicClient,wallet} from './config.js';
import {state,save,publicJob,event} from './store.js';
import {propose} from './proposal.js';
import {authorize,tick,resume,marketState,exportEvidence} from './agent.js';
import {observe,signer,requestHash} from './provider.js';
import {transact} from './transactions.js';
import {toHex} from 'viem';
acquireProcessLock('server');
const app=express(),port=Number(process.env.PORT||3102);
app.use((req,res,next)=>{let target=req.url;for(let i=0;i<3;i++){try{target=decodeURIComponent(target);}catch{break;}}if(/(?:^|[\\/])(?:\.local|\.git|\.env[^/]*|test-wallets\.json)(?:[\\/?]|$)/i.test(target))return res.status(404).end();next();});
app.use(express.json({limit:'64kb'}));
// Bind to loopback and accept mutations only from this app. No LAN/private-key API.
app.use('/api',(req,res,next)=>{const origin=req.headers.origin;if(origin&&origin!==`http://localhost:${port}`&&origin!==`http://127.0.0.1:${port}`)return res.status(403).json({error:'Local origin required'});if(req.method!=='GET'&&req.headers['content-type']?.split(';')[0]!=='application/json')return res.status(415).json({error:'JSON required'});next();});
let proposing=false;
app.get('/api/state',async(_req,res)=>{try{const d=deployment();let chain:any={status:'unavailable'};try{chain={status:'ready',chainId:await publicClient.getChainId(),blockNumber:(await publicClient.getBlockNumber()).toString()};}catch{}const markets=await marketState();res.json(JSON.parse(JSON.stringify({config:{network:'Base Sepolia',chainId:84532,collateralSymbol:'FMCT',collateralDecimals:6,marketAddress:d?.market,collateralAddress:d?.collateral,signer,requestHash,deployment:d},health:{...state.health,chain},proposal:state.proposals.at(-1),proposals:state.proposals,jobs:state.jobs.map(publicJob),markets,evidence:fs.existsSync('docs/evidence/chain-smoke.json')?[...JSON.parse(fs.readFileSync('docs/evidence/chain-smoke.json','utf8')).cases,...state.evidence]:state.evidence},(_,v)=>typeof v==='bigint'?v.toString():v)));}catch(e:any){res.status(500).json({error:e.message});}});
app.post('/api/propose',async(req,res)=>{if(proposing)return res.status(409).json({error:'A proposal is already running. The shared local model is bounded to one request per app.'});proposing=true;try{res.json(await propose(String(req.body.prompt||'Create a short ETH/USD observation market'),String(req.body.stakeUnits||'1000000')));}catch(e:any){res.status(400).json({error:e.message});}finally{proposing=false;}});
app.post('/api/authorize',(req,res)=>{try{res.json(authorize(String(req.body.proposalId)));void tick();}catch(e:any){res.status(400).json({error:e.message});}});
app.post('/api/jobs/:id/resume',(req,res)=>{try{res.json(resume(req.params.id));void tick();}catch(e:any){res.status(400).json({error:e.message});}});
app.post('/api/markets/:id/observe',async(req,res)=>{try{const j=state.jobs.find(j=>j.marketId===req.params.id);if(!j)throw Error('Market not found');const o=await observe();const d=deployment();const e=o.envelope;const receipt=await transact(j,`judge-observe:${e.timestamp}`,'deployer',d.market,artifact('FactMarket').abi,'settle',[BigInt(req.params.id),BigInt(e.timestamp),toHex(e.data),e.signature]);res.json({receipt,observation:o});}catch(e:any){res.status(400).json({error:e.shortMessage||e.message});}});
app.post('/api/markets/:id/submit',async(req,res)=>{try{const j=state.jobs.find(j=>j.marketId===req.params.id);if(!j)throw Error('Market not found');const e=req.body.envelope; if(!e||typeof e.data!=='string'||!/^0x[\da-fA-F]{130}$/.test(e.signature)||!/^\d+$/.test(String(e.timestamp)))throw Error('Envelope requires timestamp, exact signed data string and signature');const d=deployment();const label='judge-submit:'+randomBytes(5).toString('hex');const receipt=await transact(j,label,'deployer',d.market,artifact('FactMarket').abi,'settle',[BigInt(req.params.id),BigInt(e.timestamp),toHex(e.data),e.signature]);res.json({receipt});}catch(e:any){state.evidence.push({kind:'judge-submission',decision:'rejected',at:Date.now(),reason:(e.shortMessage||e.message).slice(0,1500)});save();res.status(400).json({error:e.shortMessage||e.message});}});
if(process.env.NODE_ENV==='production'){app.use(express.static('dist'));app.get('/{*path}',(_req,res)=>res.sendFile(process.cwd()+'/dist/index.html'));}else{const vite=await createViteServer({server:{middlewareMode:true},appType:'spa'});app.use(vite.middlewares);}
app.listen(port,'127.0.0.1',()=>console.log(`Fact Market http://localhost:${port}`));
setInterval(()=>void tick(),10000);void tick();
