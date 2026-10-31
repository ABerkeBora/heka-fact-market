// Local interpreter verification only. No wallet, network, signing or broadcast.
import fs from "node:fs";
import { createRequire } from "node:module";
import { parseUnits } from "viem";
import { BSV } from "../server/bsv/sdk.js";
const require = createRequire(import.meta.url),
  { createNodaryOutcome } = require("../native/consumer.cjs");
const env = JSON.parse(
  fs.readFileSync("test/fixtures/nodary-eth-usd.json", "utf8"),
);
const d = JSON.parse(env.data),
  signed = Number(env.timestamp),
  source = Math.floor(d.updatedAt / 1000);
const yes = "76a914" + "11".repeat(20) + "88ac",
  no = "76a914" + "22".repeat(20) + "88ac";
const c = createNodaryOutcome({
  requestHash: env.requestHash,
  airnodePublicKey:
    "0x044e993579608baf1d542741675d347867f3d2c558d2e9bc3b74bac3583b569322eb85068fa43e4c5abd6db7dfa74999362bebf2322554918e1e13dec3cbc1a91a",
  expectedAirnodeAddress: env.airnode,
  validFrom: source - 1,
  validTo: signed + 1,
  threshold18: (parseUnits(String(d.price), 18) - 1n).toString(),
  collateralSatoshis: 2000,
  buyerStakeSatoshis: 1000,
  yesRecipientScript: yes,
  noRecipientScript: no,
  refundAfter: signed + 120,
  refundBuyerScript: yes,
  refundCounterpartyScript: no,
});
const cases = [];
for (const edited of [false, true]) {
  const started = Date.now(),
    fund = new BSV.Transaction();
  fund.addOutput({
    satoshis: 2000,
    lockingScript: BSV.LockingScript.fromHex(c.lockingHex),
  });
  const tx = new BSV.Transaction();
  tx.addInput({
    sourceTransaction: fund,
    sourceOutputIndex: 0,
    sequence: 0xffffffff,
  });
  tx.addOutput({
    satoshis: edited ? 1999 : 2000,
    lockingScript: BSV.LockingScript.fromHex(yes),
  });
  const preimage = BSV.TransactionSignature.format({
    sourceTXID: fund.id("hex"),
    sourceOutputIndex: 0,
    sourceSatoshis: 2000,
    transactionVersion: tx.version,
    otherInputs: [],
    inputIndex: 0,
    outputs: tx.outputs,
    inputSequence: 0xffffffff,
    subscript: BSV.LockingScript.fromHex(c.postSeparatorScriptHex),
    lockTime: 0,
    scope: 0x41,
  }) as number[];
  const unlock = BSV.UnlockingScript.fromHex(
    c.unlock({ envelope: env, preimageHex: BSV.Utils.toHex(preimage) }),
  );
  tx.inputs[0]!.unlockingScript = unlock;
  let accepted = false,
    error = "";
  try {
    accepted = new BSV.Spend({
      sourceTXID: fund.id("hex"),
      sourceOutputIndex: 0,
      sourceSatoshis: 2000,
      lockingScript: fund.outputs[0]!.lockingScript,
      transactionVersion: tx.version,
      otherInputs: [],
      inputIndex: 0,
      unlockingScript: unlock,
      outputs: tx.outputs,
      inputSequence: 0xffffffff,
      lockTime: 0,
      memoryLimit: 100_000_000,
    }).validate();
  } catch (e: any) {
    error = e.message.slice(0, 150);
  }
  const expected = !edited;
  cases.push({
    name: edited
      ? "Original signature cannot reduce protected native output"
      : "Original exact API3 envelope pays fixed native output",
    accepted,
    expected,
    pass: accepted === expected,
    durationMs: Date.now() - started,
    lockingScriptBytes: c.info.lockingScriptBytes,
    preimageBytes: preimage.length,
    unlockingScriptBytes: unlock.toHex().length / 2,
    error,
  });
  console.log(cases.at(-1));
  if (accepted !== expected)
    throw Error("Native official SDK Script verification failed");
}
fs.mkdirSync("docs/evidence/bsv", { recursive: true });
fs.writeFileSync(
  "docs/evidence/bsv/native-sdk-interpreter.json",
  JSON.stringify(
    {
      checkedAt: new Date().toISOString(),
      scope:
        "Local official SDK3.2.1 native Script interpreter; historical authentic oracle fixture, dummy UTXO/recipients; no live transaction",
      status: "PASS",
      cases,
    },
    null,
    2,
  ),
);
