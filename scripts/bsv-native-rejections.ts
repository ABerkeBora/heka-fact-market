// Reproduce the public historical pilot's exact compiled-Script cases.
// No wallet, private journal, API request, transaction signing or broadcast.
import fs from "node:fs";
import { checkNativeEnvelope } from "../server/bsv/native-check.js";
const file = process.argv[2] || "docs/evidence/bsv/native-policy.json";
const m = JSON.parse(fs.readFileSync(file, "utf8"));
const fixtures = JSON.parse(
  fs.readFileSync("docs/evidence/bsv/native-judge-fixtures.json", "utf8"),
);
const cases = [];
for (const item of fixtures) {
  const result = checkNativeEnvelope(m.policy, item.env, m.funding.txid);
  const pass = result.accepted === item.expected;
  cases.push({ name: item.name, expected: item.expected, ...result, pass });
  console.log(
    JSON.stringify({
      name: item.name,
      accepted: result.accepted,
      pass,
      durationMs: result.durationMs,
    }),
  );
  if (!pass) throw Error("Native compiled Script case failed");
}
console.log(
  JSON.stringify({
    status: "PASS",
    cases: cases.length,
    scope:
      "Read-only local SDK Script execution using public actual-pilot policy and authentic historical envelopes; no live transaction submitted",
  }),
);
