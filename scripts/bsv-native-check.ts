// Usage: npm run bsv:check -- <public-market-or-policy.json> <envelope.json>
// This command has no wallet access and cannot sign or broadcast a transaction.
import fs from "node:fs";
import { checkNativeEnvelope } from "../server/bsv/native-check.js";
const [p, e] = process.argv.slice(2);
if (!p || !e)
  throw Error(
    "Usage: npm run bsv:check -- <policy-or-market.json> <envelope.json>",
  );
const m = JSON.parse(fs.readFileSync(p, "utf8")),
  envelope = JSON.parse(fs.readFileSync(e, "utf8"));
console.log(
  JSON.stringify(
    checkNativeEnvelope(
      m.policy ?? m,
      envelope.envelope ?? envelope,
      m.funding?.txid,
    ),
    null,
    2,
  ),
);
