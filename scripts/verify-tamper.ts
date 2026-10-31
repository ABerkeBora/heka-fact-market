import fs from 'node:fs';
import {decodeFunctionData,type Hex} from 'viem';
import {artifact,publicClient} from '../server/config.js';
const p='docs/evidence/chain-smoke.json',report=JSON.parse(fs.readFileSync(p,'utf8')),abi=artifact('FactMarket').abi;
const expected:any={'edited-value':'NotSignedByAirnode','stale-real-response':'ResponseTooOld','different-request':'NotSignedByAirnode','wrong-signer':'NotSignedByAirnode','duplicate-intent':'DuplicateIntent'};
for(const c of report.cases){
 const receipt=await publicClient.getTransactionReceipt({hash:c.tx}),tx=await publicClient.getTransaction({hash:c.tx});
 const decoded=decodeFunctionData({abi,data:tx.input});
 const m:any=await publicClient.readContract({address:report.contract,abi,functionName:'getMarket',args:[BigInt(report.marketId)],blockNumber:receipt.blockNumber});
 const block=await publicClient.getBlock({blockNumber:receipt.blockNumber});
 let errorName='',reason='';
 try{await publicClient.simulateContract({account:tx.from,address:report.contract,abi,functionName:decoded.functionName,args:decoded.args,blockNumber:receipt.blockNumber});}catch(e:any){const err=e.walk?.((e:any)=>e.name==='ContractFunctionRevertedError');errorName=err?.data?.errorName||'';reason=e.shortMessage||e.message;}
 const oracleCase=c.name!=='duplicate-intent';
 const inWindow=block.timestamp>=m.observationStart&&block.timestamp<=m.observationEnd;
 const matched=m.yesOwner!=='0x0000000000000000000000000000000000000000'&&m.noOwner!=='0x0000000000000000000000000000000000000000';
 const pass=receipt.status==='reverted'&&errorName===expected[c.name]&&(!oracleCase||(Number(m.state)===0&&inWindow&&matched))&&c.before.reserve===c.after.reserve&&c.before.state===c.after.state;
 c.expectedError=expected[c.name];c.actualError=errorName;c.reason=reason;c.verifiedAtBlock=receipt.blockNumber.toString();c.observationWindowOpen=inWindow;c.status=pass?'PASS':'FAIL';
 console.log(`${c.name}: ${c.status} ${errorName} block ${receipt.blockNumber}`);
}
report.tamperReasonVerifiedAt=new Date().toISOString();fs.writeFileSync(p,JSON.stringify(report,null,2)+'\n');if(report.cases.some((c:any)=>c.status!=='PASS'))throw Error('Tamper reason verification failed');
