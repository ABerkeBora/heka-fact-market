import{checkFastEnvelope}from'./fast-check.js';
import { Router } from "express";
import * as bsv from "./engine.js";
import * as native from "./native.js";
import * as fast from "./fast.js";
import { checkNativeEnvelope } from "./native-check.js";
import { exclusive, evidence } from "./journal.js";
export const bsvRouter = Router();
export function publicRecord(value: any) {
  return JSON.parse(
    JSON.stringify(value, (key, item) =>
      [
        "beef",
        "sourceBeef",
        "unsignedBeef",
        "partialRaw",
        "tx",
        "raw",
        "path",
        "reference",
        "payload",
        "rootKey",
        "privateKey",
      ].includes(key)
        ? undefined
        : item,
    ),
  );
}
bsvRouter.get("/state", async (_req, res) => {
  try {
    res.json(publicRecord(await bsv.state()));
  } catch (e: any) {
    res.status(503).json({ error: e.message });
  }
});
for (const [route, handler] of Object.entries({
  connect: bsv.connect,
  "fund-counterparty": bsv.fundCounterparty,
  authorize: bsv.authorize,
  resume: bsv.resume,
  resolve: bsv.resolve,
}))
  bsvRouter.post("/" + route, async (_req, res) => {
    try {
      res.json(publicRecord(await handler()));
    } catch (e: any) {
      res.status(400).json({ error: e.shortMessage || e.message });
    }
  });
bsvRouter.post("/propose", async (req, res) => {
  try {
    res.json(
      publicRecord(
        await bsv.propose(
          String(req.body.goal || "Create an ETH/USD observation market").slice(
            0,
            500,
          ),
        ),
      ),
    );
  } catch (e: any) {
    res.status(400).json({ error: e.shortMessage || e.message });
  }
});
bsvRouter.get("/native/state", (_req, res) =>
  res.json(publicRecord(native.nativeState())),
);
bsvRouter.post("/native/propose", async (req, res) => {
  try {
    res.json(
      publicRecord(
        await native.nativePropose(
          String(req.body.goal || "Create an ETH/USD observation market").slice(
            0,
            500,
          ),
        ),
      ),
    );
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});
for (const [name, handler] of Object.entries({
  prepare: native.nativePrepare,
  fund: native.nativeFund,
  resolve: () =>
    native.nativeResolve(native.nativeCurrent()?.activeIntent === "refund"),
  reconcile: native.nativeReconcileFunding,
  refund: () => native.nativeResolve(true),
}))
  bsvRouter.post("/native/" + name, async (_req, res) => {
    try {
      res.json(publicRecord(await handler()));
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

bsvRouter.post("/native/check", async (req, res) => {
  try {
    const m = native.nativeCurrent();
    if (!m) throw Error("No immutable native policy exists");
    const result = await exclusive(async () =>
      checkNativeEnvelope(m.policy, req.body.envelope, m.funding?.txid),
    );
    evidence(m.id + "-judge-check-" + Date.now(), result);
    res.json(result);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

bsvRouter.get('/fast/state',(_req,res)=>res.json(publicRecord(fast.fastState())));
bsvRouter.post('/fast/propose',async(req,res)=>{try{res.json(publicRecord(await fast.fastPropose(String(req.body.goal||'Create an ETH/USD observation market').slice(0,500))));}catch(e:any){res.status(400).json({error:e.message});}});
for(const[name,handler]of Object.entries({prepare:fast.fastPrepare,fund:fast.fastFund,resolve:()=>fast.fastResolve(fast.fastCurrent()?.activeIntent==='refund'),reconcile:fast.fastReconcileFunding,refund:()=>fast.fastResolve(true)}))bsvRouter.post('/fast/'+name,async(_req,res)=>{try{res.json(publicRecord(await handler()));}catch(e:any){res.status(400).json({error:e.message});}});

bsvRouter.post('/fast/check',async(req,res)=>{try{const m=fast.fastMarketForCheck(String(req.body.marketId||""));if(!m)throw Error('No immutable fast policy exists');const result=await exclusive(async()=>checkFastEnvelope(m.policy,req.body.envelope,m.funding?.txid));evidence(m.id+'-judge-check-'+Date.now(),result);res.json(result);}catch(e:any){res.status(400).json({error:e.message});}});
