import { acquireProcessLock } from "../server/lock.js";
// Explicitly publish only an already-signed testnet journal; no wallet/signing access.
import fs from "node:fs";
import { BSV, ArcadeProvider } from "../server/bsv/sdk.js";
acquireProcessLock("server");
const file = process.argv[2];
if (!file)
  throw Error(
    "Usage: tsx scripts/bsv-publish-saved.ts <ignored-testnet-journal>",
  );
const j = JSON.parse(fs.readFileSync(file, "utf8"));
if (j.network !== "testnet" || !j.txid)
  throw Error("Explicit testnet journal and canonical txid required");
const beef = j.beef ?? j.sourceBeef;
if (!beef) throw Error("Public source BEEF required for EF");
const tx = BSV.Transaction.fromAtomicBEEF(beef);
if (tx.id("hex") !== j.txid) throw Error("Canonical txid mismatch");
const r = await new ArcadeProvider(
  "https://arcade-v2-testnet-us-1.bsvblockchain.tech",
).postRawTx(tx.toHexEF(), [j.txid]);
console.log(JSON.stringify({ txid: j.txid, status: r.status, data: r.data }));
