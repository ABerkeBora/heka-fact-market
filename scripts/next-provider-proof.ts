import fs from 'node:fs';
import assert from 'node:assert/strict';
import {isAddressEqual} from 'viem';
import {FEED_REGISTRY,GoalValidationError,NODARY_ENDPOINT,NODARY_SIGNER,fetchObservation,recognizeGoalFeed,validateModelFeed} from '../server/next/registry.js';
import {recoverSigner} from '../server/airnode.js';

const response=await fetch(NODARY_ENDPOINT,{signal:AbortSignal.timeout(25000)});
if(!response.ok)throw Error(`Metadata HTTP ${response.status}`);
const metadata:any=await response.json();
assert.ok(isAddressEqual(metadata['x-airnode']?.address,NODARY_SIGNER),'Metadata signer');
const operation=metadata.paths?.['/']?.post?.requestBody?.content?.['application/json']?.schema?.oneOf?.find((o:any)=>o.properties?.operation?.const==='latestFeeds');
assert.equal(operation?.properties?.parameters?.properties?.name?.type,'string');
assert.equal(operation?.properties?.operation?.['x-airnode-price'],undefined,'No priced operation advertised');
const examples=operation.properties.parameters.properties.name.examples;
for(const recipe of FEED_REGISTRY)assert.ok(examples.includes(recipe.feed),'Official metadata explicitly includes registered feed');
const observations=[];
// Independent free read-only calls can run together; no payer/key is loaded.
const fetched=await Promise.all(FEED_REGISTRY.map(r=>fetchObservation(r.feedId)));
for(const observation of fetched){const recipe=FEED_REGISTRY[observation.feedId]!;observations.push({...recipe,observation,recoveredSigner:await recoverSigner(observation.envelope),checks:{metadataSigner:true,officialOperation:true,officialNameParameter:true,explicitFeedExample:true,exactRequestHash:true,signature:true,envelopeFreshness:true,sourceFreshness:true,freeOperation:true}});}
const goalCases=[
 {goal:'Will Ethereum be above its current USD price?',feedId:0,status:'PASS'},
 {goal:'Create a short Bitcoin observation market',feedId:1,status:'PASS'},
 {goal:'BITCOIN price in USD',feedId:1,status:'PASS'},
 {goal:'Create an ETHER market',feedId:0,status:'PASS'},
 {goal:'SOL/USD above current price',rejected:true},
 {goal:'ETH and SOL market',rejected:true},
 {goal:'Create a UNI market using Bitcoin',rejected:true},
 {goal:'Create a FOO market with BTC',rejected:true},
 {goal:'ETH or BTC next minute',rejected:true},
 {goal:'DOGE/USD',rejected:true},
 {goal:'Pick the best token',rejected:true},
 {goal:'ETH/EUR',rejected:true},
 {goal:'Create a BTC market',modelFeedId:0,rejected:true}
].map(test=>{try{const result=test.modelFeedId===undefined?recognizeGoalFeed(test.goal):validateModelFeed(test.goal,test.modelFeedId).feedId;assert.ok(!test.rejected);assert.equal(result,test.feedId);return {...test,decision:'accepted',recognizedFeedId:result,status:'PASS'};}catch(error:any){if(!test.rejected||!(error instanceof GoalValidationError))throw error;return {...test,decision:'rejected',code:error.code,message:error.message,status:'PASS'};}});
// Exercise the real proposal entry point while HTTP is disabled: rejected goals must never reach a provider/model or append a job.
const [{proposeNext},{nextStore}]=await Promise.all([import('../server/next/proposal.js'),import('../server/next/context.js')]);
const entrypointCases=[];
for(const goal of ['Create a SOL/USD market','Create a UNI market using Bitcoin','Create a FOO market with BTC','Create an ETH and BTC market']){
 const originalFetch=globalThis.fetch,jobsBefore=nextStore.state.jobs.length,proposalsBefore=nextStore.state.proposals.length;let httpCalls=0,errorCode='';
 globalThis.fetch=async()=>{httpCalls++;throw Error('Rejected goal unexpectedly reached HTTP');};
 try{await proposeNext(goal,'1000000');}catch(error:any){if(!(error instanceof GoalValidationError))throw error;errorCode=error.code;}finally{globalThis.fetch=originalFetch;}
 assert.ok(['UNSUPPORTED_ASSET','AMBIGUOUS_ASSET'].includes(errorCode));assert.equal(httpCalls,0);assert.equal(nextStore.state.jobs.length,jobsBefore);assert.equal(nextStore.state.proposals.length,proposalsBefore);
 entrypointCases.push({goal,status:'PASS',code:errorCode,httpCalls,jobsBefore,jobsAfter:nextStore.state.jobs.length,proposalsBefore,proposalsAfter:nextStore.state.proposals.length,paymentSubmitted:false});
}
const proof={checkedAt:new Date().toISOString(),checkedAtBerlin:new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin',dateStyle:'short',timeStyle:'long'}).format(new Date()),version:'next',source:NODARY_ENDPOINT,metadata:{title:metadata.info.title,version:metadata.info.version,signer:metadata['x-airnode'].address,operation:'latestFeeds',nameParameter:operation.properties.parameters.properties.name,attestation:metadata['x-airnode'].attestation},fee:{priced:false,amountUnits:'0',paymentTransactions:[],note:'Nodary latestFeeds is free. This proof contains no x402 purchase or collateral payment.'},observations,goalCases,entrypointCases};
fs.mkdirSync('docs/evidence/v2',{recursive:true});
fs.writeFileSync('docs/evidence/v2/provider-registry.json',JSON.stringify(proof,null,2)+'\n');
console.log(JSON.stringify({checkedAt:proof.checkedAt,feeds:observations.map(o=>({feedId:o.feedId,feed:o.feed,requestHash:o.requestHash,recipeHash:o.recipeHash,price:o.observation.price,sourceAt:o.observation.sourceAt,signedAt:o.observation.signedAt,signer:o.recoveredSigner})),goalCases:goalCases.map(t=>({goal:t.goal,status:t.status,decision:t.decision})),entrypointCases},null,2));
