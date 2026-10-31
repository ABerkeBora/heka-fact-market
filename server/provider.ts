import fs from 'node:fs';
import {deriveRequestHash,verifySignedResponse,type SignedResponse} from './airnode.js';
import {publicClient} from './config.js';
export const request={operation:'latestFeeds',parameters:{name:'ETH/USD'},responseProjection:{price:'/ETH~1USD/value',updatedAt:'/ETH~1USD/timestamp'}};
export const signer='0xE70f1e8b22a21e4Bb5188918a3033341b281E4c0' as const;
export const requestHash=deriveRequestHash(request);
export async function observe(feed='ETH/USD') {
 const req=feed==='ETH/USD'?request:{...request,parameters:{name:feed},responseProjection:{price:`/${feed.replaceAll('/','~1')}/value`,updatedAt:`/${feed.replaceAll('/','~1')}/timestamp`}};
 const r=await fetch('https://airnode-nodary.fly.dev/',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(req),signal:AbortSignal.timeout(25000)});
 if(!r.ok) throw Error(`Nodary HTTP ${r.status}; no signed evidence accepted`);
 const env=await r.json() as SignedResponse;
 await verifySignedResponse(env,signer,deriveRequestHash(req));
 const data=JSON.parse(env.data); const now=Number((await publicClient.getBlock()).timestamp);
 const sourceAt=Math.floor(Number(data.updatedAt)/1000), signedAt=Number(env.timestamp);
 if(!Number.isFinite(data.price)||data.price<=0 || !Number.isSafeInteger(sourceAt))throw Error('Invalid source observation');
 if(signedAt>now+5||sourceAt>now+5||signedAt+120<now||sourceAt+120<now)throw Error('Oracle response is stale or from the future');
 return {envelope:env,price:data.price,priceDisplay:`$${data.price.toFixed(2)}`,sourceAt,signedAt,request:req,receivedAt:now};
}
