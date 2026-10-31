import test from "node:test";
import assert from "node:assert/strict";
import { BSV } from "./sdk.js";
import { inspectNodeValidatedTransaction } from "./node-proof.js";
const source = "11".repeat(32), blockHash = "22".repeat(32);
function fixture() {
  const tx = new BSV.Transaction();
  tx.addInput({ sourceTXID: source, sourceOutputIndex: 4, unlockingScript: new BSV.UnlockingScript(), sequence: 0xffffffff });
  tx.addOutput({ satoshis: 1000, lockingScript: BSV.LockingScript.fromHex("76a914" + "44".repeat(20) + "88ac") });
  return { txid: tx.id("hex"), raw: tx.toHex(), size: tx.toBinary().length };
}
function node(overrides: Record<string, any> = {}) {
  const f = fixture(), calls: string[] = [];
  const fetcher = (async (url: any, options: any) => {
    assert.equal(options.method, "GET"); calls.push(String(url));
    const kind = String(url).includes("/txmeta/") ? "meta" : String(url).includes(source) ? "input" : "output";
    const value = kind in overrides ? overrides[kind] : kind === "meta"
      ? { tx: { txid: f.txid }, fee: 100, sizeInBytes: f.size, blockIDs: [], blockHashes: [], blockHeights: null, mainChainIndex: -1 }
      : kind === "input" ? { status: 1, spendingData: { txId: f.txid, vin: 0 } } : { status: 0 };
    return value instanceof Response ? value : Response.json(value);
  }) as typeof fetch;
  return { ...f, fetcher, calls };
}
test("complete canonical node UTXO transition is execution evidence, not mining", async () => {
  const n = node(), p = await inspectNodeValidatedTransaction(n.raw, undefined, n.fetcher);
  assert.equal(p?.status, "VALIDATED_BY_NODE_UTXO");
  assert.equal(p?.miningStatus, "UNCONFIRMED"); assert.equal(p?.blockHash, undefined);
  assert.equal(p?.inputs[0].spendingTxid, n.txid); assert.equal(p?.inputs[0].vin, 0);
  assert.equal(p?.outputs[0].satoshis, 1000); assert.match(p?.outputs[0].scriptSha256 || "", /^[a-f0-9]{64}$/);
  assert.equal(p?.inputCount, p?.inputs.length); assert.equal(p?.outputCount, p?.outputs.length);
  assert.equal(n.calls.length, 3); assert.equal(JSON.stringify(p).includes(n.raw), false);
});
test("raw-store metadata alone, missing inputs or locked outputs cannot prove validation", async () => {
  for (const change of [{ input: { status: 0 } }, { output: { status: 7 } }, { output: new Response("", { status: 404 }) }, { meta: new Response("", { status: 202 }) }]) {
    const n = node(change); assert.equal(await inspectNodeValidatedTransaction(n.raw, undefined, n.fetcher), null);
  }
});
test("wrong metadata identity, outpoint, spender or vin is rejected", async () => {
  for (const change of [
    { meta: { tx: { txid: source } } },
    { input: { txid: "33".repeat(32), status: 1, spendingData: { txId: fixture().txid, vin: 0 } } },
    { input: { status: 1, spendingData: { txId: source, vin: 0 } } },
    { input: { status: 1, spendingData: { txId: fixture().txid, vin: 1 } } },
  ]) { const n = node(change); await assert.rejects(inspectNodeValidatedTransaction(n.raw, undefined, n.fetcher)); }
});
test("another canonical spender is distinct from a malformed same-transaction vin", async () => {
  const other = node({ input: { status: 1, spendingData: { txId: source, vin: 0 } } });
  await assert.rejects(inspectNodeValidatedTransaction(other.raw, undefined, other.fetcher),
    { message: "Canonical input was spent by another transaction" });
  const badVin = node({ input: { status: 1, spendingData: { txId: fixture().txid, vin: 1 } } });
  await assert.rejects(inspectNodeValidatedTransaction(badVin.raw, undefined, badVin.fetcher),
    { message: "Canonical input spend vin does not match transaction input" });
});
test("spent outputs remain evidence of creation, but conflicting output state is rejected", async () => {
  const n = node({ output: { status: 1, spendingData: { txId: source, vin: 2 } } });
  assert.equal((await inspectNodeValidatedTransaction(n.raw, undefined, n.fetcher))?.outputs[0].status, 1);
  const bad = node({ output: { status: 6 } });
  await assert.rejects(inspectNodeValidatedTransaction(bad.raw, undefined, bad.fetcher));
});
test("mining status needs a real main-chain block reference", async () => {
  const f = fixture(), n = node({ meta: { tx: { txid: f.txid }, fee: 100, sizeInBytes: f.size,
    blockIDs: [9], blockHashes: [blockHash], blockHeights: [123], mainChainIndex: 0 } });
  const p = await inspectNodeValidatedTransaction(n.raw, undefined, n.fetcher);
  assert.equal(p?.miningStatus, "MINED"); assert.equal(p?.blockHash, blockHash); assert.equal(p?.blockHeight, 123);
});
test("timeouts/rate limits remain pending and providers/response sizes are bounded", async () => {
  const n = node({ meta: new Response("", { status: 429 }) });
  assert.equal(await inspectNodeValidatedTransaction(n.raw, undefined, n.fetcher), null);
  await assert.rejects(inspectNodeValidatedTransaction(n.raw, "https://example.invalid", n.fetcher), /Testnet/);
  const large = node({ output: new Response("x".repeat(65537)) });
  await assert.rejects(inspectNodeValidatedTransaction(large.raw, undefined, large.fetcher), /byte limit/);
});
