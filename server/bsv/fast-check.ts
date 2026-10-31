import { createRequire } from "node:module";
import { parseUnits } from "viem";
import { BSV } from "./sdk.js";
const require = createRequire(import.meta.url),
  { createNodaryFastAsm } = require("../../native/fast/consumer-fast-asm.cjs");
/** Read-only Script execution against an immutable policy/outpoint. No wallet or broadcast. */
export function checkFastEnvelope(
  policy: any,
  envelope: any,
  sourceTXID = "00".repeat(32),
) {
  if (
    !envelope ||
    typeof envelope.data !== "string" ||
    Buffer.byteLength(envelope.data) > 1000 ||
    !/^\d{1,20}$/.test(String(envelope.timestamp)) ||
    !/^0x[\da-f]{130}$/i.test(envelope.signature)
  )
    throw Error(
      "Provide timestamp, original data string and 65-byte signature",
    );
  const consumer = createNodaryFastAsm(policy);
  let outcome: "yes" | "no" = "yes";
  try {
    outcome =
      parseUnits(String(JSON.parse(envelope.data).price), 18) >
      BigInt(policy.threshold18)
        ? "yes"
        : "no";
  } catch {}
  const script =
      outcome === "yes" ? policy.yesRecipientScript : policy.noRecipientScript,
    tx = new BSV.Transaction();
  tx.addInput({
    sourceTXID,
    sourceOutputIndex: 0,
    sequence: 0xffffffff,
    unlockingScript: new BSV.UnlockingScript(),
  });
  tx.addOutput({
    satoshis: Number(policy.collateralSatoshis),
    lockingScript: BSV.LockingScript.fromHex(script),
  });
  const preimage = BSV.TransactionSignature.format({
    sourceTXID,
    sourceOutputIndex: 0,
    sourceSatoshis: Number(policy.collateralSatoshis),
    transactionVersion: tx.version,
    otherInputs: [],
    inputIndex: 0,
    outputs: tx.outputs,
    inputSequence: 0xffffffff,
    subscript: BSV.LockingScript.fromHex(consumer.postSeparatorScriptHex),
    lockTime: 0,
    scope: 0x41,
  });
  // The contract pins requestHash. Ignore the envelope's unsigned header here so
  // wrong-request signatures reach the VM rather than a JavaScript header gate.
  const unlock = BSV.UnlockingScript.fromHex(
    consumer.unlock({
      envelope: { ...envelope, requestHash: policy.requestHash },
      preimageHex: BSV.Utils.toHex(preimage),
    }),
  );
  let accepted = false,
    reason = "";
  const started = Date.now();
  try {
    accepted = new BSV.Spend({
      sourceTXID,
      sourceOutputIndex: 0,
      sourceSatoshis: Number(policy.collateralSatoshis),
      lockingScript: BSV.LockingScript.fromHex(consumer.lockingHex),
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
    reason = e.message.slice(0, 300);
  }
  return {
    accepted,
    outcome: accepted ? outcome : null,
    reason: accepted
      ? "Original signature, window, predicate and fixed output passed the native Script"
      : reason || "Native Script rejected",
    durationMs: Date.now() - started,
    lockingScriptSha256: consumer.info.lockingScriptSha256,
    sourceTXID,
    network: "testnet",
    scope:
      "Read-only native Script VM; no transaction signed or broadcast and no collateral state changed",
    checkedAt: new Date().toISOString(),
  };
}
