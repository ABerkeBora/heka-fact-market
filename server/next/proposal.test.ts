import test from 'node:test';
import assert from 'node:assert/strict';
import {derivePolicyHash,deriveThreshold,modelSchema,propose,signedPrice,validateProposal,type PolicyInput} from './proposal.js';
import {getRecipe} from './registry.js';

const ethSuggestion={feedId:0,thresholdOffsetBps:25,side:'yes',explanation:'A bounded ETH observation with a fixed source window.'};

test('model chooses an explicit numeric allowlisted feed; strict schema excludes arbitrary authority',()=>{
 assert.deepEqual(validateProposal(ethSuggestion,'Create an ETH/USD observation'),ethSuggestion);
 const btc={...ethSuggestion,feedId:1};
 assert.deepEqual(validateProposal(btc,'Create a Bitcoin market'),btc);
 for(const change of [{feedId:2},{feedId:'0'},{thresholdOffsetBps:100},{side:'any'},{explanation:'short'},
  {recipient:'0x1111111111111111111111111111111111111111'},{requestHash:'0x1234'},{templateId:'arbitrary-api'},{calldata:'0x01'}]){
  assert.throws(()=>modelSchema.parse({...ethSuggestion,...change}));
 }
});

test('schema-valid model feed mismatch cannot become a funded proposal',()=>{
 assert.throws(()=>validateProposal(ethSuggestion,'Observe BTC/USD'),/different asset/);
 assert.throws(()=>validateProposal({...ethSuggestion,feedId:1},'Observe Ethereum'),/different asset/);
 assert.throws(()=>validateProposal(ethSuggestion,'Observe ETH and BTC'),/Choose one asset/);
});

test('unsupported or ambiguous goals stop before any provider or model HTTP call',async()=>{
 const original=globalThis.fetch;let calls=0;
 globalThis.fetch=async()=>{calls++;throw Error('No external call should occur');};
 try{
  for(const goal of ['Observe SOL/USD','Observe ETH and BTC','Observe $XYZ','Create a market','Observe ETH/EUR']){
   await assert.rejects(propose(goal,'1000000'));
  }
  assert.equal(calls,0);
 }finally{globalThis.fetch=original;}
});

test('invalid stake also stops before any provider or model call',async()=>{
 const original=globalThis.fetch;let calls=0;
 globalThis.fetch=async()=>{calls++;throw Error('No external call should occur');};
 try{
  for(const stake of ['1.0','-100000','99999','10000001','not-an-integer'])await assert.rejects(propose('ETH/USD observation',stake),/Stake must/);
  assert.equal(calls,0);
 }finally{globalThis.fetch=original;}
});

test('threshold arithmetic uses exact signed decimals and bounded integer bps, floored to cents',()=>{
 assert.deepEqual(deriveThreshold('2245.995',-25),{thresholdUsd:'2240.38',threshold18:'2240380000000000000000'});
 assert.deepEqual(deriveThreshold('82967.68',25),{thresholdUsd:'83175.09',threshold18:'83175090000000000000000'});
 assert.deepEqual(deriveThreshold('2245.995',0),{thresholdUsd:'2245.99',threshold18:'2245990000000000000000'});
 for(const price of ['0','-1','1e3','NaN','1.1234567890123456789'])assert.throws(()=>deriveThreshold(price,0));
 assert.throws(()=>deriveThreshold('100',26 as any));
 assert.equal(signedPrice('{"price":2245.995,"updatedAt":1793417445000}'),'2245.995');
 assert.throws(()=>signedPrice('{"price":1,"price":2,"updatedAt":1793417445000}'),/exactly one/);
});

test('policy hash binds the exact V2 Solidity ABI fields, source recipe, amount and window',()=>{
 const p:PolicyInput={market:'0x1111111111111111111111111111111111111111',collateral:'0x2222222222222222222222222222222222222222',recipe:getRecipe(0),threshold18:'2245990000000000000000',stakeUnits:'1000000',closesAt:1793417565,observationStart:1793417566,observationEnd:1793417866};
 // Independent Foundry cast abi-encode + keccak vector for the contract's exact policy fields.
 const expected='0xabaf975df732dedfbfeec436758580c6a3ea6d276bc4982fe5f6788e364b1067';
 assert.equal(derivePolicyHash(p),expected);
 for(const change of [{recipe:getRecipe(1)},{threshold18:'2246000000000000000000'},{stakeUnits:'2000000'},
  {market:'0x3333333333333333333333333333333333333333' as const},{collateral:'0x4444444444444444444444444444444444444444' as const},
  {closesAt:p.closesAt+1},{observationStart:p.observationStart+1},{observationEnd:p.observationEnd+1}])assert.notEqual(derivePolicyHash({...p,...change}),expected);
});
