import test from "node:test";
import assert from "node:assert/strict";
import { inspectKnownWalletSpends } from "./wallet-reconcile.js";
import { BSV } from "./sdk.js";

const source = "11".repeat(32), txid = "22".repeat(32), block = "33".repeat(32);
function wallet(outputs: any[], extras: any = {}) {
  return {
    getNetwork: async () => ({ network: "testnet" }),
    getPublicKey: async () => ({ publicKey: "identity" }),
    listActions: async () => ({ totalActions: 1, actions: [{ txid: source, outputs }] }),
    ...extras,
  };
}
function proof(overrides: any = {}): typeof fetch {
  return (async () => Response.json({
    txid, hash: txid, blockhash: block, confirmations: 2,
    vin: [{ txid: source, vout: 4 }], ...overrides,
  })) as typeof fetch;
}
test("blocks a mined externally spent source still offered by standard wallet", async () => {
  const r = await inspectKnownWalletSpends(wallet([{ outputIndex: 4, spendable: true }]), [{ txid }], proof());
  assert.equal(r.status, "blocked");
  assert.deepEqual(r.conflicts, [{ outpoint: source + ".4", spentBy: txid }]);
});
test("unspent unrelated outputs and historical missing change do not block", async () => {
  const r = await inspectKnownWalletSpends(wallet([
    { outputIndex: 4, spendable: false }, { outputIndex: 1, spendable: true },
  ]), [{ txid }], proof());
  assert.equal(r.status, "ready");
  assert.equal(r.conflicts.length, 0);
  assert.match(r.reason, /not counted as recovered/);
});
test("requires mined canonical proof, not queued/raw-store visibility", async () => {
  for (const override of [{ confirmations: 0, blockhash: undefined }, { txid: source }, { hash: source }]) {
    const r = await inspectKnownWalletSpends(wallet([]), [{ txid }], proof(override));
    assert.equal(r.status, "unknown");
  }
});
test("provider outage fails closed without any wallet mutation methods", async () => {
  const r = await inspectKnownWalletSpends(wallet([]), [{ txid }], (async () => { throw Error("offline"); }) as typeof fetch);
  assert.equal(r.status, "unknown");
  assert.match(r.reason, /offline/);
});
test("checks later history pages rather than overlooking spent sources", async () => {
  const offsets: number[] = [];
  const w = wallet([], { listActions: async ({ offset }: any) => {
    offsets.push(offset);
    return offset === 0
      ? { totalActions: 101, actions: Array.from({ length: 100 }, () => ({ txid: "44".repeat(32), outputs: [] })) }
      : { totalActions: 101, actions: [{ txid: source, outputs: [{ outputIndex: 4, spendable: true }] }] };
  } });
  const r = await inspectKnownWalletSpends(w, [{ txid }], proof());
  assert.deepEqual(offsets, [0, 100]);
  assert.equal(r.status, "blocked");
});
test("refuses changed identity and mainnet before chain or wallet-history lookup", async () => {
  const mustNotFetch = (async () => { throw Error("unexpected lookup"); }) as typeof fetch;
  assert.equal((await inspectKnownWalletSpends(wallet([]), [{ txid, expectedIdentity: "another" }], mustNotFetch)).status, "blocked");
  assert.equal((await inspectKnownWalletSpends(wallet([], { getNetwork: async () => ({ network: "mainnet" }) }), [{ txid }], mustNotFetch)).status, "blocked");
});
test("rejects a mismatched frozen raw transaction before accepting metadata", async () => {
  const r = await inspectKnownWalletSpends(wallet([]), [{ txid, raw: "00" }], proof());
  assert.equal(r.status, "unknown");
  assert.match(r.reason, /canonical ID/);
});

function unconfirmedReservation() {
  const tx = new BSV.Transaction();
  tx.addInput({ sourceTXID: source, sourceOutputIndex: 4,
    unlockingScript: new BSV.UnlockingScript(), sequence: 0xffffffff });
  tx.addOutput({ satoshis: 1000,
    lockingScript: BSV.LockingScript.fromHex("76a914" + "44".repeat(20) + "88ac") });
  return { txid: tx.id("hex"), raw: tx.toHex(), requireMined: false };
}
test("an explicitly recorded canonical unconfirmed reservation can resume without claiming mining", async () => {
  const record = unconfirmedReservation();
  const r = await inspectKnownWalletSpends(wallet([{ outputIndex: 4, spendable: false }]), [record],
    proof({ txid: record.txid, hash: record.txid, blockhash: undefined, confirmations: 0 }));
  assert.equal(r.status, "ready");
  assert.equal(r.verifiedTransactions[0].status, "NETWORK_VISIBLE_UNCONFIRMED");
  assert.equal(r.verifiedTransactions[0].blockHash, null);
  assert.equal(r.verifiedTransactions[0].confirmations, 0);
});
test("unconfirmed opt-in still rejects absent/mismatched raw, mismatched inputs and spendable conflicts", async () => {
  const record = unconfirmedReservation();
  const pending = { txid: record.txid, hash: record.txid, blockhash: undefined, confirmations: 0 };
  for (const invalid of [{ ...record, raw: undefined }, { ...record, raw: record.raw + "00" }])
    assert.equal((await inspectKnownWalletSpends(wallet([]), [invalid], proof(pending))).status, "unknown");
  assert.equal((await inspectKnownWalletSpends(wallet([]), [record],
    proof({ ...pending, vin: [{ txid: source, vout: 5 }] }))).status, "unknown");
  const conflict = await inspectKnownWalletSpends(wallet([{ outputIndex: 4, spendable: true }]), [record], proof(pending));
  assert.equal(conflict.status, "blocked");
  assert.deepEqual(conflict.conflicts, [{ outpoint: source + ".4", spentBy: record.txid }]);
});
