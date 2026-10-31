import { acquireProcessLock } from "../server/lock.js";
/** Explicit testnet-only bootstrap for a fresh isolated local profile.
 * Creates a CP-owned1900sat source; never runs at startup. Requires the local
 * counterparty wallet to have test funds first. No EVM transaction is needed.
 */
import { BSV } from "../server/bsv/sdk.js";
import { counterWallet, testWallet } from "../server/bsv/wallets.js";
import { read, write } from "../server/bsv/journal.js";
import { PROTOCOL, payoutScript } from "../server/bsv/policy.js";
acquireProcessLock("server");
const w = await testWallet(await counterWallet()),
  keyID = "native-counterparty-source-v1",
  script = payoutScript(
    (
      await w.getPublicKey({
        protocolID: PROTOCOL,
        keyID,
        counterparty: "anyone",
        forSelf: true,
      })
    ).publicKey,
  );
let j = read<any>("native/cp-bootstrap");
if (j?.txid) {
  console.log(
    JSON.stringify({
      status: "already prepared; do not create another",
      txid: j.txid,
    }),
  );
  process.exit(0);
}
if (j)
  throw Error("Existing bootstrap intent must be reconciled, never replaced");
write("native/cp-bootstrap", { status: "requested" });
const action = await w.createAction({
  description: "Prepare native market counterparty source",
  outputs: [
    {
      lockingScript: script,
      satoshis: 1900,
      outputDescription: "Owned testnet prediction source",
      basket: "fact-market-native-cp",
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
if (!action.signableTransaction) throw Error("Missing signable bootstrap");
const tx = BSV.Transaction.fromAtomicBEEF(action.signableTransaction.tx),
  fee =
    tx.inputs.reduce(
      (a: any, i: any) =>
        a + i.sourceTransaction.outputs[i.sourceOutputIndex].satoshis,
      0,
    ) - tx.outputs.reduce((a: any, o: any) => a + o.satoshis, 0);
if (fee < 0 || fee > 500) throw Error("Bootstrap fee exceeds500test-sat cap");
write("native/cp-bootstrap", {
  status: "prepared",
  reference: action.signableTransaction.reference,
});
const signed = await w.signAction({
  reference: action.signableTransaction.reference,
  spends: {},
  options: { noSend: true },
});
if (!signed.tx || !signed.txid)
  throw Error("Signing uncertain; reconcile existing wallet action");
const source = BSV.Transaction.fromAtomicBEEF(signed.tx),
  vout = source.outputs.findIndex(
    (o: any) => o.satoshis === 1900 && o.lockingScript.toHex() === script,
  );
if (vout < 0) throw Error("Missing exact source output");
const record = {
  network: "testnet",
  txid: signed.txid,
  beef: Array.from(signed.tx),
  vout,
  keyID,
  feeSats: fee,
};
write("native/cp-bootstrap", { ...record, status: "signed" });
write("native/counterparty-source", record);
console.log(
  JSON.stringify({
    status:
      "signed; reconcile exact canonical hash with official Arcade before native funding",
    txid: signed.txid,
    vout,
    feeSats: fee,
  }),
);
