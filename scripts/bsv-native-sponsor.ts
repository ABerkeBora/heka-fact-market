import { acquireProcessLock } from "../server/lock.js";
/** Optional fresh-clone fee sponsor using the standard testnet wallet.
 * Commands: seed --accept-testnet-seed-12000-fee-cap-500 ; sign <funding-plan.json>
 * Never called by the app. Never exposes a wallet private key.
 */
import fs from "node:fs";
import { createRequire } from "node:module";
import { BSV } from "../server/bsv/sdk.js";
import { userWallet, testWallet } from "../server/bsv/wallets.js";
import { read, write } from "../server/bsv/journal.js";
import {
  PROTOCOL,
  payoutScript,
  signatureHash,
  txSignature,
} from "../server/bsv/policy.js";
acquireProcessLock("server");
const require = createRequire(import.meta.url),
  { createNodaryOutcome } = require("../native/consumer.cjs"),
  [command, arg] = process.argv.slice(2),
  keyID = "native-fee-sponsor-v1",
  w = await testWallet(userWallet),
  pub = (
    await w.getPublicKey({
      protocolID: PROTOCOL,
      keyID,
      counterparty: "anyone",
      forSelf: true,
    })
  ).publicKey,
  script = payoutScript(pub);
if (command === "seed") {
  if (arg !== "--accept-testnet-seed-12000-fee-cap-500")
    throw Error(
      "Explicit testnet seed amount12000 and fee cap500 acknowledgment required",
    );
  if (read("fee-sponsor-public") || read("native/sponsor-seed"))
    throw Error("Existing sponsor source/intent must not be replaced");
  write("native/sponsor-seed", { status: "requested" });
  const action = await w.createAction({
    description: "Prepare bounded native contract fee sponsor",
    outputs: [
      {
        lockingScript: script,
        satoshis: 12000,
        outputDescription: "Self-owned native deployment fee source",
        basket: "fact-market-native-fee",
        customInstructions: JSON.stringify({
          protocolID: PROTOCOL,
          keyID,
          counterparty: "anyone",
        }),
      },
    ],
    options: {
      signAndProcess: false,
      randomizeOutputs: false,
      acceptDelayedBroadcast: false,
    },
  });
  if (!action.signableTransaction) throw Error("Missing signable seed");
  const tx = BSV.Transaction.fromAtomicBEEF(action.signableTransaction.tx),
    fee =
      tx.inputs.reduce(
        (a: any, i: any) =>
          a + i.sourceTransaction.outputs[i.sourceOutputIndex].satoshis,
        0,
      ) - tx.outputs.reduce((a: any, o: any) => a + o.satoshis, 0);
  if (fee < 0 || fee > 500) throw Error("Seed fee exceeds500test sats");
  write("native/sponsor-seed", {
    status: "prepared",
    reference: action.signableTransaction.reference,
  });
  const signed = await w.signAction({
    reference: action.signableTransaction.reference,
    spends: {},
    options: { noSend: true },
  });
  if (!signed.tx || !signed.txid)
    throw Error("Signing uncertain; reconcile original wallet action");
  const source = BSV.Transaction.fromAtomicBEEF(signed.tx),
    vout = source.outputs.findIndex(
      (o: any) => o.satoshis === 12000 && o.lockingScript.toHex() === script,
    );
  if (vout < 0) throw Error("Missing exact source");
  const record = {
    network: "testnet",
    txid: signed.txid,
    sourceBeef: Array.from(signed.tx),
    vout,
    satoshis: 12000,
    lockingScript: script,
    returnLockingScript: script,
    requiredReturnSatoshis: 6000,
    maxFeeSatoshis: 6000,
    requiredEscrowSatoshis: 2000,
  };
  write("fee-sponsor-public", record);
  write("native/sponsor-seed", {
    ...record,
    beef: record.sourceBeef,
    feeSats: fee,
    status: "signed",
  });
  console.log(
    JSON.stringify({
      txid: signed.txid,
      status: "signed; publish exact saved source first",
      feeSats: fee,
    }),
  );
} else if (command === "sign") {
  if (!arg) throw Error("Funding plan path required");
  const plan = JSON.parse(fs.readFileSync(arg, "utf8")),
    source = read<any>("fee-sponsor-public");
  if (
    !source ||
    source.network !== "testnet" ||
    source.lockingScript !== script ||
    source.returnLockingScript !== script
  )
    throw Error("This wallet does not own the configured sponsor source");
  if (
    plan.network !== "testnet" ||
    plan.sponsorInputIndex !== 2 ||
    plan.returnOutputIndex !== 2 ||
    plan.feeSatoshis !== 6000 ||
    Date.now() / 1000 >= plan.policy.validFrom
  )
    throw Error(
      "Plan requires exact6000test fee and a future observation window",
    );
  const frozen = read<any>("native/funding-signed");
  if (frozen) {
    console.log(
      JSON.stringify({
        txid: frozen.txid,
        status: "existing signature frozen; reuse canonical raw",
      }),
    );
    process.exit(0);
  }
  const consumer = createNodaryOutcome(plan.policy),
    tx: any = BSV.Transaction.fromHex(plan.partialRaw);
  if (
    tx.inputs.length !== 3 ||
    tx.outputs.length !== 3 ||
    tx.outputs[0].satoshis !== 2000 ||
    tx.outputs[0].lockingScript.toHex() !== consumer.lockingHex ||
    tx.outputs[1].satoshis !== 900 ||
    tx.outputs[1].lockingScript.toHex() !==
      plan.policy.refundCounterpartyScript ||
    tx.outputs[2].satoshis !== 6000 ||
    tx.outputs[2].lockingScript.toHex() !== script
  )
    throw Error("Fixed output policy changed");
  for (const s of plan.sources) {
    const t = BSV.Transaction.fromAtomicBEEF(s.beef),
      i = tx.inputs[s.inputIndex];
    if (i.sourceTXID !== t.id("hex")) throw Error("Source outpoint mismatch");
    i.sourceTransaction = t;
  }
  if (
    tx.inputs[2].sourceTXID !== source.txid ||
    tx.inputs[2].sourceOutputIndex !== source.vout ||
    tx.inputs[2].sourceTransaction.outputs[source.vout].satoshis !== 12000
  )
    throw Error("Sponsor source changed");
  const amounts = tx.inputs.map(
    (i: any) => i.sourceTransaction.outputs[i.sourceOutputIndex].satoshis,
  );
  if (amounts.join(",") !== "1000,1900,12000")
    throw Error("Participant/sponsor amounts changed");
  if (
    tx.inputs[0].sourceTransaction.outputs[
      tx.inputs[0].sourceOutputIndex
    ].lockingScript.toHex() !== plan.policy.refundBuyerScript
  )
    throw Error("Buyer refund ownership changed");
  for (const index of [0, 1]) {
    const i = tx.inputs[index],
      o = i.sourceTransaction.outputs[i.sourceOutputIndex];
    if (
      !new BSV.Spend({
        sourceTXID: i.sourceTXID,
        sourceOutputIndex: i.sourceOutputIndex,
        sourceSatoshis: o.satoshis,
        lockingScript: o.lockingScript,
        transactionVersion: tx.version,
        otherInputs: tx.inputs.filter((_: any, n: number) => n !== index),
        inputIndex: index,
        unlockingScript: i.unlockingScript,
        outputs: tx.outputs,
        inputSequence: i.sequence,
        lockTime: tx.lockTime,
        memoryLimit: 100_000_000,
      }).validate()
    )
      throw Error("Participant full-output signature invalid");
  }
  const { hash, scope } = signatureHash(tx, 2),
    sig = await w.createSignature({
      protocolID: PROTOCOL,
      keyID,
      counterparty: "anyone",
      hashToDirectlySign: hash,
    }),
    bytes = txSignature(Array.from(sig.signature), scope),
    p = BSV.Utils.toArray(pub, "hex");
  tx.inputs[2].unlockingScript = new BSV.UnlockingScript([
    { op: bytes.length, data: bytes },
    { op: p.length, data: p },
  ]);
  if (!(await tx.verify("scripts only", undefined, 100_000_000)))
    throw Error("Signed funding validation failed");
  const result = {
    network: "testnet",
    txid: tx.id("hex"),
    raw: tx.toHex(),
    at: new Date().toISOString(),
  };
  write("native/funding-signed", result);
  console.log(
    JSON.stringify({
      txid: result.txid,
      status: "signed once; use native/fund exact intent",
    }),
  );
} else
  throw Error(
    "Usage: seed --accept-testnet-seed-12000-fee-cap-500 | sign <plan>",
  );
