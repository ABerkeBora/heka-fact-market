import test from "node:test";
import assert from "node:assert/strict";
import {
  isAcceptedProof,
  isCanonicalInputConflict,
  maySignSpend,
  mayStartMarket,
  refundMature,
  selectSpendKind,
} from "./fast-state.js";

const txid = "11".repeat(32),
  otherTxid = "22".repeat(32);
const proof = { txid, status: "MINED", blockHash: "aa".repeat(32) };
const draft = { id: "future-policy", status: "draft", policy: { validFrom: 100 } };
const rollover = (change: Record<string, unknown> = {}) =>
  mayStartMarket({
    market: draft,
    fundingJournal: null,
    buyerSeed: null,
    now: 100,
    ...change,
  });
const rejectedPreparation = {
  txid: otherTxid,
  definitiveRejection: {
    txStatus: "REJECTED",
    extraInfo: "UTXO_SPENT (70): source consumed by independently reconciled tx",
  },
  aborted: { aborted: true },
};

test("only the explicit loser-transaction conflict allows probing the other frozen spend", () => {
  const exact = "Canonical input was spent by another transaction";
  assert.equal(isCanonicalInputConflict(new Error(exact)), true);
  for (const message of [
    "Canonical input was spent by another transaction or input index",
    "Canonical input spend vin does not match transaction input",
    "Node UTXO response identifies another transaction",
    "Node UTXO response identifies another output",
    "Spent node UTXO lacks a canonical spending reference",
    "Node transaction metadata identifies another transaction",
    exact + ": unexpected context",
  ]) assert.equal(isCanonicalInputConflict(new Error(message)), false);
  for (const value of [undefined, null, exact, { message: exact }])
    assert.equal(isCanonicalInputConflict(value), false);
});

test("automatic no-data expiry chooses the refund journal, including a stale claim label", () => {
  for (const activeIntent of [undefined, "claim"] as const) {
    assert.equal(
      selectSpendKind({
        now: 101,
        validTo: 100,
        hasCapturedObservation: false,
        activeIntent,
      }),
      "refund",
    );
  }
  assert.equal(
    selectSpendKind({ now: 100, validTo: 100, hasCapturedObservation: false }),
    "claim",
    "The immutable observation interval includes its endpoint",
  );
});

test("a captured original observation or frozen claim remains the same claim after the window", () => {
  assert.equal(
    selectSpendKind({ now: 200, validTo: 100, hasCapturedObservation: true }),
    "claim",
  );
  assert.equal(
    selectSpendKind({
      now: 200,
      validTo: 100,
      hasCapturedObservation: false,
      hasClaim: true,
    }),
    "claim",
    "An unresolved signed claim cannot be silently replaced by a refund",
  );
  assert.equal(
    selectSpendKind({
      now: 200,
      validTo: 100,
      hasCapturedObservation: true,
      activeIntent: "refund",
    }),
    "refund",
  );
});

test("a pre-signed recovery spend can resume after expiry without renewed signing authority", () => {
  assert.equal(maySignSpend({ now: 99, expiry: 100, existingSigned: false }), true);
  assert.equal(maySignSpend({ now: 100, expiry: 100, existingSigned: false }), false);
  assert.equal(maySignSpend({ now: 200, expiry: 100, existingSigned: false }), false);
  assert.equal(maySignSpend({ now: 200, expiry: 100, existingSigned: true }), true);
  assert.equal(maySignSpend({ now: NaN, expiry: 100, existingSigned: false }), false);
});

test("refund requires known chain median time strictly beyond nLockTime", () => {
  assert.equal(refundMature(null, 100), false);
  assert.equal(refundMature(99, 100), false);
  assert.equal(refundMature(100, 100), false);
  assert.equal(refundMature(101, 100), true);
  assert.equal(refundMature(NaN, 100), false);
  assert.equal(refundMature(101.5, 100), false);
  assert.equal(refundMature(101, -1), false);
});

test("transport, gossip and unconfirmed raw-store observations are never validation evidence", () => {
  for (const status of ["RECEIVED", "QUEUED", "REJECTED", "STORED", "PENDING", "ACCEPTED_BY_NETWORK", "SEEN_MULTIPLE_NODES", "NETWORK_VISIBLE_UNCONFIRMED"]) {
    assert.equal(isAcceptedProof({ txid, status, http: 202 }), false);
    assert.equal(isAcceptedProof({ txid, status, http: 200, rawMatchesOriginal: true }), false);
  }
  assert.equal(
    isAcceptedProof({ txid, http: 200, rawMatchesOriginal: true }),
    false,
  );
  assert.equal(isAcceptedProof({ status: "MINED" }), false);
  assert.equal(isAcceptedProof({ txid: "not-a-transaction", status: "MINED" }), false);
  assert.equal(isAcceptedProof({ txid, status: "MINED" }), false);
  assert.equal(isAcceptedProof({ txid, status: "MINED", blockHash: "not-a-block" }), false);
  assert.equal(isAcceptedProof(proof), true);
  assert.equal(isAcceptedProof({ txid, status: "MINED", blockhash: "bb".repeat(32) }), true);
});

test("HTTP200 plus exact raw retrieval still only acknowledges transport", () => {
  const acknowledgement = {
    txid,
    status: "ACCEPTED_BY_NODE",
    http: 200,
    witness: { http: 200, decodedTxid: txid, rawMatchesOriginal: true },
  };
  assert.equal(isAcceptedProof(acknowledgement), false);
});

const validated = () => ({
  txid,
  status: "VALIDATED_BY_NODE_UTXO",
  http: 200,
  rawMatchesOriginal: true,
  validatedInputs: true,
  validatedOutputs: true,
  inputCount: 2,
  outputCount: 2,
  totalOutputCount: 2,
  inputs: [
    { inputIndex: 0, sourceTxid: otherTxid, vout: 0, status: 1, spendingTxid: txid, vin: 0 },
    { inputIndex: 1, sourceTxid: otherTxid, vout: 1, status: 1, spendingTxid: txid, vin: 1 },
  ],
  outputs: [
    { outputIndex: 0, status: 0, satoshis: 2000, scriptSha256: "33".repeat(32) },
    { outputIndex: 1, status: 0, satoshis: 800, scriptSha256: "44".repeat(32) },
  ],
});

test("native validation requires complete canonical UTXO evidence for every input and positive output", () => {
  assert.equal(isAcceptedProof(validated()), true);
  for (const change of [
    { http: 202 }, { rawMatchesOriginal: false }, { validatedInputs: false },
    { validatedOutputs: false }, { inputCount: 3 }, { outputCount: 3 },
    { totalOutputCount: 1 }, { inputs: [] }, { outputs: [] },
  ]) assert.equal(isAcceptedProof({ ...validated(), ...change }), false);
  const spentOutput: any = validated();
  spentOutput.outputs[0] = { ...spentOutput.outputs[0], status: 1, spendingTxid: "55".repeat(32), vin: 2 };
  assert.equal(isAcceptedProof(spentOutput), true, "A validated output may already have a validated child spend");
});

test("locked/missing UTXOs, wrong spending identity/vin and duplicate evidence cannot validate a transaction", () => {
  for (const change of [
    { status: 0 }, { status: 7 }, { inputIndex: 1 }, { vin: 1 },
    { spendingTxid: otherTxid }, { sourceTxid: "broken" }, { vout: -1 },
  ]) {
    const candidate = validated();
    candidate.inputs[0] = { ...candidate.inputs[0], ...change };
    assert.equal(isAcceptedProof(candidate), false);
  }
  const duplicateInput = validated();
  duplicateInput.inputs[1].vout = 0;
  assert.equal(isAcceptedProof(duplicateInput), false);
  for (const change of [
    { status: 7 }, { status: 2 }, { outputIndex: 2 }, { outputIndex: 1 },
    { satoshis: 0 }, { scriptSha256: "broken" }, { status: 1 },
    { status: 0, spendingTxid: otherTxid, vin: 0 },
  ]) {
    const candidate = validated();
    candidate.outputs[0] = { ...candidate.outputs[0], ...change };
    assert.equal(isAcceptedProof(candidate), false);
  }
});

test("only genuinely expired and unfunded drafts may roll over", () => {
  assert.equal(rollover({ now: 99 }), false);
  assert.equal(rollover(), true);
  assert.equal(rollover({ market: null }), true);
  for (const field of ["fundingJournal", "fundingPlan", "fundingSigned"]) {
    assert.equal(rollover({ [field]: { txid } }), false);
    assert.equal(rollover({ market: null, [field]: { txid } }), false);
  }
  for (const field of ["funding", "fundingSeen", "plan"]) {
    assert.equal(rollover({ market: { ...draft, [field]: { txid } } }), false);
  }
  assert.equal(rollover({ market: { ...draft, status: "waiting" } }), false);
});

test("uncertain signatures and valid participant prep UTXOs block rollover", () => {
  for (const source of [
    { status: "requested" },
    { reference: "unknown-wallet-action" },
    { txid, accepted: false },
    { txid, accepted: true, satoshis: 1000 },
    { ...rejectedPreparation, aborted: { aborted: false } },
    { ...rejectedPreparation, definitiveRejection: { txStatus: "REJECTED", extraInfo: "HTTP413" } },
  ]) {
    assert.equal(rollover({ buyerSeed: source }), false);
    assert.equal(rollover({ counterpartySource: source }), false);
  }
  assert.equal(rollover({ buyerSeed: rejectedPreparation }), true);
  const recovery = {
    status: "retry-authorized-after-definitive-rejection",
    priorAttempts: [rejectedPreparation],
  };
  assert.equal(rollover({ buyerSeed: recovery }), true);
  assert.equal(rollover({ buyerSeed: { ...recovery, reference: "new-uncertain-action" } }), false);
  assert.equal(rollover({ buyerSeed: { ...recovery, priorAttempts: [] } }), false);
  assert.equal(
    rollover({ buyerSeed: { ...recovery, priorAttempts: [rejectedPreparation, { txid }] } }),
    false,
  );
});

test("paid/refunded labels alone cannot archive protected collateral", () => {
  for (const status of ["paid", "refunded"]) {
    assert.equal(rollover({ market: { ...draft, status } }), false);
    assert.equal(
      rollover({ market: { ...draft, status, payout: { txid, proof: { txid, status: "RECEIVED" } } } }),
      false,
    );
    assert.equal(
      rollover({ market: { ...draft, status, payout: { txid, proof: { txid, status: "NETWORK_VISIBLE_UNCONFIRMED" } } } }),
      false,
      "Transport/index presence cannot release the next pool budget",
    );
    assert.equal(
      rollover({ market: { ...draft, status, payout: { txid: otherTxid, proof } } }),
      false,
    );
    assert.equal(
      rollover({ market: { ...draft, status, payout: { txid, proof } }, fundingJournal: { txid: otherTxid } }),
      true,
      "The matching final spend resolves the previous funding journal",
    );
    assert.equal(
      rollover({ market: { ...draft, status, payout: { txid, proof: validated() } } }),
      true,
      "Explicit full UTXO validation permits rollover before block confirmation",
    );
  }
});
