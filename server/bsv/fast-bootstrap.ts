import { BSV, ArcadeProvider } from "./sdk.js";
import { counterWallet, testWallet } from "./wallets.js";
import { PROTOCOL, payoutScript } from "./policy.js";
import { read, write, evidence } from "./journal.js";
/** Called only after the NEW fast mandate/artifact gate, under the BSV executor lock. */
export async function prepareFastCounterparty(m: any) {
  const w = await testWallet(await counterWallet()),
    keyID = m.id + ":funding",
    pub = (
      await w.getPublicKey({
        protocolID: PROTOCOL,
        keyID,
        counterparty: "anyone",
        forSelf: true,
      })
    ).publicKey,
    script = payoutScript(pub);
  let j = read<any>("fast/counterparty-source");
  if (j && j.id !== m.id)
    throw Error("Another fast counterparty intent exists; never replace it");
  if (!j) {
    // Existing canonical noSend bookkeeping only; no inputs/outputs/signatures or fee.
    const historical = read<any>("market"),
      known = historical?.deposits?.find(
        (d: any) => d.role === "counterparty" && d.txid,
      );
    if (known) {
      const result = await w.createAction({
        description: "Reconcile existing counterparty action",
        outputs: [],
        options: { sendWith: [known.txid], acceptDelayedBroadcast: false },
      });
      if (result.txid)
        throw Error("Unexpected new transaction during bookkeeping");
    }
    j = { id: m.id, network: "testnet", status: "requested", keyID };
    write("fast/counterparty-source", j);
    const action = await w.createAction({
      description: "Prepare fast market counterparty stake",
      labels: [m.id],
      outputs: [
        {
          lockingScript: script,
          satoshis: 1900,
          outputDescription: "Own fast stake and external claim-fee source",
          basket: "fact-market-fast-source",
          customInstructions: JSON.stringify({
            protocolID: PROTOCOL,
            keyID,
            counterparty: "anyone",
          }),
        },
      ],
      options: {
        randomizeOutputs: false,
        signAndProcess: false,
        acceptDelayedBroadcast: false,
      },
    });
    if (!action.signableTransaction)
      throw Error("Missing signable CP preparation; reconcile wallet action");
    const tx = BSV.Transaction.fromAtomicBEEF(action.signableTransaction.tx),
      fee =
        tx.inputs.reduce(
          (a: number, i: any) =>
            a + i.sourceTransaction.outputs[i.sourceOutputIndex].satoshis,
          0,
        ) - tx.outputs.reduce((a: number, o: any) => a + o.satoshis, 0);
    if (!Number.isSafeInteger(fee) || fee < 0 || fee > 500)
      throw Error("New CP preparation exceeds500test-sat fee cap");
    j = {
      ...j,
      status: "prepared",
      feeSats: fee,
      reference: action.signableTransaction.reference,
    };
    write("fast/counterparty-source", j);
  }
  if (!j.txid) {
    if (!j.reference)
      throw Error(
        "CP preparation request uncertain; reconcile existing action, do not replace",
      );
    const signed = await w.signAction({
      reference: j.reference,
      spends: {},
      options: { noSend: true },
    });
    if (!signed.tx || !signed.txid)
      throw Error("CP preparation signing uncertain");
    const tx = BSV.Transaction.fromAtomicBEEF(signed.tx),
      vout = tx.outputs.findIndex(
        (o: any) => o.satoshis === 1900 && o.lockingScript.toHex() === script,
      );
    if (vout < 0) throw Error("CP preparation recipient/amount mismatch");
    j = {
      ...j,
      status: "signed",
      txid: signed.txid,
      beef: Array.from(signed.tx),
      vout,
      at: new Date().toISOString(),
    };
    write("fast/counterparty-source", j);
  }
  const tx = BSV.Transaction.fromAtomicBEEF(j.beef);
  if (
    tx.id("hex") !== j.txid ||
    tx.outputs[j.vout]?.satoshis !== 1900 ||
    tx.outputs[j.vout]?.lockingScript.toHex() !== script
  )
    throw Error("Frozen CP source changed");
  if (!j.accepted) {
    const r = await new ArcadeProvider(
      "https://arcade-v2-testnet-us-1.bsvblockchain.tech",
    ).postRawTx(tx.toHexEF(), [j.txid]);
    if (r.status !== "success")
      throw Error(
        "Exact CP preparation publication unresolved; do not sign replacement",
      );
    const observed = await new ArcadeProvider(
      "https://arcade-v2-testnet-us-1.bsvblockchain.tech",
    ).getTxData(j.txid);
    if (
      observed.txid !== j.txid ||
      !["MINED", "SEEN_MULTIPLE_NODES", "ACCEPTED_BY_NETWORK"].includes(
        observed.txStatus,
      )
    )
      throw Error("Exact CP preparation is submitted; network acceptance pending");
    j.accepted = true;
    j.proof = { txid: observed.txid, status: observed.txStatus };
    write("fast/counterparty-source", j);
    evidence(m.id + "-cp-preparation", {
      id: m.id,
      network: "testnet",
      txid: j.txid,
      vout: j.vout,
      satoshis: 1900,
      stakeShare: 1000,
      externalFeeChange: 900,
      feeSats: j.feeSats,
      proof: j.proof,
      at: j.at,
      scope: "Self-owned setup UTXO, not yet a pool deposit",
    });
  }
  await reconcileFastCounterpartySource(j);
  return j;
}

/** Reconcile only the already-signed preparation; never create another payment. */
export async function reconcileFastCounterpartySource(j:any){
  if(!j?.txid||j.walletReconciled)return j;
  const w=await testWallet(await counterWallet());
  const r=await w.createAction({description:"Reconcile existing opposing preparation",outputs:[],options:{sendWith:[j.txid],acceptDelayedBroadcast:false}});
  if(r.txid)throw Error("Counterparty bookkeeping unexpectedly created a payment");
  j.walletReconciliation=r;j.walletReconciled=r.sendWithResults?.some((x:any)=>x.txid===j.txid&&["unproven","sending","completed"].includes(x.status))===true;write("fast/counterparty-source",j);
  if(!j.walletReconciled)throw Error("Existing counterparty preparation awaits wallet reconciliation; no replacement");
  return j;
}
