import {test} from 'node:test';
import assert from 'node:assert/strict';
import {deriveRequestHash,verifySignedResponse} from './airnode.js';
import {request,requestHash,signer} from './provider.js';
import {validateProposal} from './proposal.js';
import fs from 'node:fs';
test('model cannot choose arbitrary template, offset, recipient or transaction',()=>{
 const valid={templateId:'nodary-eth-window-v1',thresholdOffsetBps:25,side:'yes',explanation:'A bounded observation above the current reference.'};
 assert.deepEqual(validateProposal(valid),valid);
 for(const edit of [{templateId:'arbitrary-api'},{thresholdOffsetBps:1000},{recipient:'0x0000000000000000000000000000000000000001'},{side:'anything'}])assert.throws(()=>validateProposal({...valid,...edit}));
});
test('exact request hash is canonical and projection bound',()=>{
 assert.equal(requestHash,'0x180eae9387bb66a72380e61ebe0a00d19f8414a716a37ebe1df124b66acfff66');
 assert.equal(deriveRequestHash({...request,responseProjection:{updatedAt:'/ETH~1USD/timestamp',price:'/ETH~1USD/value'}}),requestHash);
 assert.notEqual(deriveRequestHash({...request,parameters:{name:'BTC/USD'}}),requestHash);
 assert.notEqual(deriveRequestHash({...request,responseProjection:{price:'/ETH~1USD/value'}}),requestHash);
});
