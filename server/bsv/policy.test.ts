import test from "node:test";
import assert from "node:assert/strict";
import { BSV } from "./sdk.js";
import {
  digest,
  assertPolicy,
  collateralScript,
  outputsFor,
  validateOutputs,
  signatureHash,
} from "./policy.js";
const yes = BSV.PrivateKey.fromRandom(),
  no = BSV.PrivateKey.fromRandom(),
  attestor = BSV.PrivateKey.fromRandom(),
  outsider = BSV.PrivateKey.fromRandom();
const f = {
  network: "testnet",
  stakeSats: 1000,
  feeSats: 100,
  thresholdCents: 224000,
  closesAt: 100,
  observationStart: 101,
  observationEnd: 1000,
  userSide: "yes",
  yesPub: yes.toPublicKey().toString(),
  noPub: no.toPublicKey().toString(),
  attestorPub: attestor.toPublicKey().toString(),
};
const p = { ...f, policyHash: digest(f) };
function make() {
  const source = new BSV.Transaction();
  source.addOutput({
    satoshis: 1000,
    lockingScript: BSV.LockingScript.fromHex(collateralScript(p)),
  });
  const tx = new BSV.Transaction();
  tx.addInput({
    sourceTransaction: source,
    sourceOutputIndex: 0,
    sequence: 0xffffffff,
  });
  tx.addInput({
    sourceTransaction: source,
    sourceOutputIndex: 0,
    sourceTXID: "11".repeat(32),
    sequence: 0xffffffff,
  });
  for (const o of outputsFor(p, "yes"))
    tx.addOutput({
      satoshis: o.satoshis,
      lockingScript: BSV.LockingScript.fromHex(o.lockingScript),
    });
  return tx;
}
function sign(
  tx: ReturnType<typeof make>,
  beneficiary = yes,
  oracle = attestor,
  branch = true,
) {
  const { hash, scope } = signatureHash(tx, 0);
  const b = BSV.ECDSA.sign(new BSV.BigNumber(hash), beneficiary, true),
    a = BSV.ECDSA.sign(new BSV.BigNumber(hash), oracle, true);
  const bb = new BSV.TransactionSignature(b.r, b.s, scope).toChecksigFormat(),
    aa = new BSV.TransactionSignature(a.r, a.s, scope).toChecksigFormat();
  tx.inputs[0]!.unlockingScript = new BSV.UnlockingScript([
    { op: bb.length, data: bb },
    { op: branch ? BSV.OP.OP_1 : BSV.OP.OP_0 },
    { op: aa.length, data: aa },
  ]);
}
function valid(tx: ReturnType<typeof make>) {
  const i = tx.inputs[0]!,
    source = i.sourceTransaction!.outputs[0]!;
  try {
    return new BSV.Spend({
      sourceTXID: i.sourceTransaction!.id("hex"),
      sourceOutputIndex: 0,
      sourceSatoshis: 1000,
      lockingScript: source.lockingScript,
      transactionVersion: tx.version,
      otherInputs: tx.inputs.slice(1),
      outputs: tx.outputs,
      inputIndex: 0,
      unlockingScript: i.unlockingScript!,
      inputSequence: 0xffffffff,
      lockTime: tx.lockTime,
    }).validate();
  } catch {
    return false;
  }
}
test("real Bitcoin Script requires the attestor AND the chosen fixed beneficiary", () => {
  const t = make();
  sign(t);
  assert.equal(valid(t), true);
  sign(t, attestor);
  assert.equal(valid(t), false);
  sign(t, yes, outsider);
  assert.equal(valid(t), false);
  sign(t, no);
  assert.equal(valid(t), false);
  sign(t, no, attestor, false);
  assert.equal(valid(t), true);
});
test("SIGHASH_ALL rejects changed recipient and changed satoshi amount after approval", () => {
  const t = make();
  sign(t);
  t.outputs[0]!.satoshis = 1899;
  assert.equal(valid(t), false);
  const q = make();
  sign(q);
  q.outputs[0]!.lockingScript = new BSV.P2PKH().lock(
    outsider.toPublicKey().toHash(),
  );
  assert.equal(valid(q), false);
});
test("policy commitment cannot be transplanted to a different source window", () => {
  const t = make();
  sign(t);
  const changed = { ...p, observationEnd: 1001 };
  changed.policyHash = digest({ ...f, observationEnd: 1001 });
  t.inputs[0]!.sourceTransaction!.outputs[0]!.lockingScript =
    BSV.LockingScript.fromHex(collateralScript(changed));
  assert.equal(valid(t), false);
});
test("deterministic payout policy conserves stakes minus fixed fee and refuses extra outputs", () => {
  assert.equal(outputsFor(p, "yes")[0]!.satoshis, 1900);
  assert.equal(
    outputsFor(p, "void").reduce((s, o) => s + o.satoshis, 0),
    1900,
  );
  const t = make();
  assert.equal(validateOutputs(p, "yes", t), digest(outputsFor(p, "yes")));
  t.addOutput({
    satoshis: 1,
    lockingScript: new BSV.P2PKH().lock(outsider.toPublicKey().toHash()),
  });
  assert.throws(() => validateOutputs(p, "yes", t));
});
test("mainnet, altered cap and identical attestor/beneficiary are blocked", () => {
  assertPolicy(p);
  for (const change of [
    { network: "mainnet" },
    { stakeSats: 2000 },
    { attestorPub: p.yesPub },
    { policyHash: "00".repeat(32) },
  ])
    assert.throws(() => assertPolicy({ ...p, ...change }));
});
