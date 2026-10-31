import {publicClient} from '../config.js';
import {createAgentEngine} from '../agent.js';
import {createExecutor} from '../transactions.js';
import {nextStore,nextWallet,nextDeployment} from './context.js';
import {FEED_REGISTRY,fetchObservation} from './registry.js';
export const nextContext={namespace:'next',...nextStore,wallet:nextWallet,deployment:nextDeployment,contractName:'FactMarketNext',observe:async(feed?:string)=>{const r=FEED_REGISTRY.find(r=>r.feed===feed);if(!r)throw Error('Unrecognized pinned feed');return fetchObservation(r.feedId,Number((await publicClient.getBlock()).timestamp));},evidencePath:'docs/evidence/v2/agent-runs.json',createMarketArgs:(p:any)=>[Number(p.feedId),BigInt(p.threshold18),BigInt(p.stakeUnits),BigInt(p.closesAt),BigInt(p.observationStart),BigInt(p.observationEnd)]};
export const nextEngine=createAgentEngine(nextContext);
export const nextExecutor=createExecutor(nextContext);
