import {encodeAbiParameters,isAddressEqual,keccak256,toHex,type Address,type Hex} from 'viem';
import {deriveRequestHash,verifySignedResponse,type AirnodeV2Request,type SignedResponse} from '../airnode.js';

export type FeedId=0|1;
export const NODARY_ENDPOINT='https://airnode-nodary.fly.dev/';
export const NODARY_SIGNER='0xE70f1e8b22a21e4Bb5188918a3033341b281E4c0' as const;
export const OBSERVATION_POLICY='FIRST_ACCEPTED_FRESH_SOURCE_IN_WINDOW_ELSE_VOID';
export const MAX_ENVELOPE_AGE=120,MAX_SOURCE_AGE=120,FUTURE_TOLERANCE=5;
export type Recipe={feedId:FeedId,feed:'ETH/USD'|'BTC/USD',symbol:'ETH'|'BTC',assetName:string,source:'Nodary',method:'POST',endpoint:typeof NODARY_ENDPOINT,signer:typeof NODARY_SIGNER,request:AirnodeV2Request,requestHash:Hex,unit:string,unitCode:'USD',decimals:18,predicate:'gt',observationPolicy:typeof OBSERVATION_POLICY,recipeHash:Hex};
const hashText=(value:string)=>keccak256(toHex(value));
/** ABI order exactly matches FactMarketNext.recipeHashFor. The request hash binds operation/parameters/projection. */
export function deriveRecipeHash(recipe:Pick<Recipe,'feedId'|'signer'|'requestHash'>):Hex{
 return keccak256(encodeAbiParameters([
  {type:'bytes32'},{type:'uint8'},{type:'address'},{type:'bytes32'},{type:'bytes32'},{type:'bytes32'},
  {type:'uint8'},{type:'bytes32'},{type:'bytes32'},{type:'uint256'},{type:'uint256'},{type:'uint256'}
 ],[hashText('FACT_MARKET_RECIPE_V2'),recipe.feedId,recipe.signer,recipe.requestHash,hashText(NODARY_ENDPOINT),hashText('USD'),18,hashText('GT'),hashText(OBSERVATION_POLICY),120n,120n,5n]));
}
function makeRecipe(feedId:FeedId,symbol:'ETH'|'BTC',assetName:string):Recipe{
 const feed=`${symbol}/USD` as Recipe['feed'];
 const parameters=Object.freeze({name:feed});
 const responseProjection=Object.freeze({price:`/${symbol}~1USD/value`,updatedAt:`/${symbol}~1USD/timestamp`});
 const request=Object.freeze({operation:'latestFeeds',parameters,responseProjection});
 const requestHash=deriveRequestHash(request);
 return Object.freeze({feedId,feed,symbol,assetName,source:'Nodary',method:'POST',endpoint:NODARY_ENDPOINT,signer:NODARY_SIGNER,request,requestHash,unit:`USD per ${symbol}`,unitCode:'USD',decimals:18,predicate:'gt',observationPolicy:OBSERVATION_POLICY,recipeHash:deriveRecipeHash({feedId,signer:NODARY_SIGNER,requestHash})});
}
export const FEED_REGISTRY:readonly Recipe[]=Object.freeze([makeRecipe(0,'ETH','Ether'),makeRecipe(1,'BTC','Bitcoin')]);
export const registry=FEED_REGISTRY;
export function getRecipe(feedId:unknown):Recipe{
 if(typeof feedId!=='number'||!Number.isInteger(feedId)||(feedId!==0&&feedId!==1))throw new GoalValidationError('UNSUPPORTED_ASSET','Choose ETH/USD or BTC/USD. This registry cannot execute another feed.');
 return FEED_REGISTRY[feedId]!;
}
export class GoalValidationError extends Error{
 constructor(public code:'ASSET_REQUIRED'|'AMBIGUOUS_ASSET'|'UNSUPPORTED_ASSET'|'MODEL_FEED_MISMATCH',message:string){super(message);this.name='GoalValidationError';}
}
const ETH=/\b(?:eth|ether|ethereum)\b/i,BTC=/\b(?:btc|bitcoin)\b/i;
// Known unsupported asset names/tickers are rejected even when a supported asset also appears.
const unsupported=/\b(?:sol|solana|ada|cardano|xrp|ripple|doge|dogecoin|uni|uniswap|pepe|bonk|floki|aave|near|fet|rune|icp|hbar|avax|avalanche|matic|polygon|bnb|binance\s+coin|ltc|litecoin|bch|bitcoin\s+cash|dot|polkadot|link|chainlink|atom|cosmos|sui|apt|aptos|trx|tron|shib|shiba|usdt|tether|usdc|eur|euro|gold|xau|silver|xag|oil)\b/i;
/** Deterministic bounded asset recognition runs before the model. No default asset is selected. */
export function recognizeGoalFeed(goal:unknown):FeedId{
 if(typeof goal!=='string'||goal.trim().length===0||goal.length>500)throw new GoalValidationError('ASSET_REQUIRED','Describe one ETH/USD or BTC/USD market in 500 characters or fewer.');
 const text=goal.normalize('NFKC');
 const allowedTickers=new Set(['ETH','ETHER','ETHEREUM','BTC','BITCOIN','USD','YES','NO','AI','API','GT']);
 const unknownTicker=[...text.matchAll(/\b[A-Z][A-Z0-9]{1,11}\b/g)].map(m=>m[0]).find(t=>!allowedTickers.has(t));
 if(unknownTicker)throw new GoalValidationError('UNSUPPORTED_ASSET','An uppercase ticker is outside the ETH/USD and BTC/USD registry. Name one supported asset only.');
 if(unsupported.test(text))throw new GoalValidationError('UNSUPPORTED_ASSET','Only ETH/USD and BTC/USD are supported. Remove the unsupported asset or quote currency.');
 const eth=ETH.test(text),btc=BTC.test(text);
 if(eth&&btc)throw new GoalValidationError('AMBIGUOUS_ASSET','Choose one asset: ETH/USD or BTC/USD. A single market cannot select both.');
 for(const match of text.matchAll(/\b([a-z][a-z0-9]{1,11})\s*\/\s*([a-z][a-z0-9]{1,11})\b/gi)){
  if(!['eth','ether','ethereum','btc','bitcoin'].includes(match[1]!.toLowerCase())||match[2]!.toLowerCase()!=='usd')throw new GoalValidationError('UNSUPPORTED_ASSET','This recipe registry supports only ETH/USD or BTC/USD.');
 }
 for(const match of text.matchAll(/\$([a-z][a-z0-9]{1,11})\b/gi)){
  if(!['eth','ether','ethereum','btc','bitcoin','usd'].includes(match[1]!.toLowerCase()))throw new GoalValidationError('UNSUPPORTED_ASSET','The requested ticker is outside the ETH/USD and BTC/USD registry.');
 }
 if(!eth&&!btc)throw new GoalValidationError('ASSET_REQUIRED','Name ETH, Ether or Ethereum; or BTC or Bitcoin. No market is selected automatically.');
 return eth?0:1;
}
/** A schema-valid model output is still rejected if its chosen feed differs from the user's recognized asset. */
export function validateModelFeed(goal:unknown,feedId:unknown):Recipe{
 const expected=recognizeGoalFeed(goal),recipe=getRecipe(feedId);
 if(recipe.feedId!==expected)throw new GoalValidationError('MODEL_FEED_MISMATCH','The model selected a different asset from the goal; no market or payment was created.');
 return recipe;
}

export function validateObservation(recipe:Recipe,envelope:SignedResponse,nowSeconds:number){
 if(!Number.isSafeInteger(nowSeconds))throw Error('Observation validation requires a valid clock');
 const data=JSON.parse(envelope.data);
 if(typeof data.price!=='number'||!Number.isFinite(data.price)||data.price<=0||typeof data.updatedAt!=='number'||!Number.isSafeInteger(data.updatedAt)||data.updatedAt<=0)throw Error('Signed projection is missing a positive price or millisecond source timestamp');
 const sourceAt=Math.floor(data.updatedAt/1000),signedAt=Number(envelope.timestamp);
 if(!Number.isSafeInteger(signedAt)||signedAt<0||signedAt>nowSeconds+FUTURE_TOLERANCE||sourceAt>nowSeconds+FUTURE_TOLERANCE||signedAt+MAX_ENVELOPE_AGE<nowSeconds||sourceAt+MAX_SOURCE_AGE<nowSeconds)throw Error('Oracle response is stale or from the future');
 return {feedId:recipe.feedId,feed:recipe.feed,recipeHash:recipe.recipeHash,requestHash:recipe.requestHash,price:data.price as number,priceDisplay:`$${data.price.toFixed(2)}`,sourceAt,signedAt,receivedAt:nowSeconds,envelope,request:recipe.request};
}
export async function fetchObservation(feedId:unknown,nowSeconds?:number){
 const recipe=getRecipe(feedId);
 const response=await fetch(recipe.endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(recipe.request),signal:AbortSignal.timeout(25000)});
 if(!response.ok)throw Error(`Nodary HTTP ${response.status}; no signed evidence accepted`);
 if(response.headers.has('PAYMENT-RESPONSE'))throw Error('Unexpected payment receipt on a free operation');
 const envelope=await response.json() as SignedResponse;
 await verifySignedResponse(envelope,recipe.signer,recipe.requestHash);
 if(!isAddressEqual(envelope.airnode as Address,recipe.signer))throw Error('Unexpected envelope Airnode identity');
 return validateObservation(recipe,envelope,nowSeconds??Math.floor(Date.now()/1000));
}
