/** Pure recovery decisions. These classify saved evidence; they do not query or sign. */
export type SpendKind = "claim" | "refund";

const canonicalTxid = (value: unknown): value is string =>
  typeof value === "string" && /^[0-9a-f]{64}$/i.test(value);
const seconds = (value: unknown): value is number =>
  Number.isSafeInteger(value) && Number(value) >= 0;

/** Only a loser spend's explicit conflict may defer to the other frozen branch. */
export function isCanonicalInputConflict(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message === "Canonical input was spent by another transaction"
  );
}

/** Transport acknowledgements and gossip/raw-store presence are not validation. */
export function isAcceptedProof(proof: any): boolean {
  if (!proof || !canonicalTxid(proof.txid)) return false;
  if (proof.status === "MINED")
    return canonicalTxid(proof.blockHash ?? proof.blockhash);
  if (
    proof.status !== "VALIDATED_BY_NODE_UTXO" ||
    proof.http !== 200 ||
    proof.rawMatchesOriginal !== true ||
    proof.validatedInputs !== true ||
    proof.validatedOutputs !== true ||
    !seconds(proof.inputCount) || proof.inputCount < 1 ||
    !seconds(proof.outputCount) || proof.outputCount < 1 ||
    !seconds(proof.totalOutputCount) || proof.totalOutputCount < proof.outputCount ||
    !Array.isArray(proof.inputs) || proof.inputs.length !== proof.inputCount ||
    !Array.isArray(proof.outputs) || proof.outputs.length !== proof.outputCount
  ) return false;

  const txid = proof.txid.toLowerCase(), outpoints = new Set<string>();
  for (let index = 0; index < proof.inputs.length; index++) {
    const input = proof.inputs[index];
    if (
      input?.status !== 1 || input.inputIndex !== index || input.vin !== index ||
      !canonicalTxid(input.sourceTxid) || !seconds(input.vout) || input.vout > 0xffffffff ||
      !canonicalTxid(input.spendingTxid) || input.spendingTxid.toLowerCase() !== txid
    ) return false;
    const outpoint = input.sourceTxid.toLowerCase() + ":" + input.vout;
    if (outpoints.has(outpoint)) return false;
    outpoints.add(outpoint);
  }
  const outputIndexes = new Set<number>();
  for (const output of proof.outputs) {
    if (
      !seconds(output?.outputIndex) || output.outputIndex >= proof.totalOutputCount ||
      outputIndexes.has(output.outputIndex) ||
      !seconds(output.satoshis) || output.satoshis < 1 ||
      !canonicalTxid(output.scriptSha256) || ![0, 1].includes(output.status)
    ) return false;
    if (output.status === 1 &&
      (!canonicalTxid(output.spendingTxid) || !seconds(output.vin) || output.vin > 0xffffffff))
      return false;
    if (output.status === 0 &&
      (output.spendingTxid != null || output.vin != null)) return false;
    outputIndexes.add(output.outputIndex);
  }
  return true;
}

/** A stored primary claim must be reconciled before selecting a fallback spend. */
export function selectSpendKind(args: {
  forceRefund?: boolean;
  now: number;
  validTo: number;
  hasCapturedObservation: boolean;
  activeIntent?: SpendKind;
  hasClaim?: boolean;
}): SpendKind {
  // The caller must establish that any previous claim is conclusively rejected
  // before requesting this explicit recovery branch.
  if (args.forceRefund || args.activeIntent === "refund") return "refund";
  if (args.hasClaim) return "claim";
  return args.now > args.validTo && !args.hasCapturedObservation
    ? "refund"
    : "claim";
}

/** Timestamp nLockTime must be strictly below the chain's median time. */
export function refundMature(
  medianTime: number | null,
  refundAfter: number,
): boolean {
  return seconds(medianTime) && seconds(refundAfter) && medianTime > refundAfter;
}

/**
 * Whether the spend operation may proceed. `existingSigned` means reuse only;
 * the caller's signing branch must still be guarded by !existingSigned.
 */
export function maySignSpend(args: {
  now: number;
  expiry: number;
  existingSigned: boolean;
}): boolean {
  return (
    args.existingSigned ||
    (seconds(args.now) && seconds(args.expiry) && args.now < args.expiry)
  );
}

function abortedHardRejection(attempt: any): boolean {
  return (
    canonicalTxid(attempt?.txid) &&
    attempt?.definitiveRejection?.txStatus === "REJECTED" &&
    typeof attempt.definitiveRejection.extraInfo === "string" &&
    attempt.definitiveRejection.extraInfo.includes("UTXO_SPENT") &&
    attempt.aborted?.aborted === true
  );
}

function resolvedPreparation(source: any): boolean {
  if (!source) return true;
  if (abortedHardRejection(source)) return true;
  // This recovery pointer preserves the original signed attempts; it is not a
  // valid prepared UTXO or permission to sign another payment.
  return (
    source.status === "retry-authorized-after-definitive-rejection" &&
    !source.txid &&
    !source.reference &&
    !source.beef &&
    !source.unsignedBeef &&
    Array.isArray(source.priorAttempts) &&
    source.priorAttempts.length > 0 &&
    source.priorAttempts.every(abortedHardRejection)
  );
}

/** No rollover can discard an uncertain funding transaction or a valid prep UTXO. */
export function mayStartMarket(args: {
  market: any | null;
  fundingJournal: any | null;
  buyerSeed: any | null;
  now: number;
  fundingPlan?: any;
  fundingSigned?: any;
  counterpartySource?: any;
}): boolean {
  const m = args.market;
  if (m && ["paid", "refunded"].includes(m.status)) {
    const payout = m.payout;
    return (
      canonicalTxid(payout?.txid) &&
      isAcceptedProof(payout.proof) &&
      payout.txid.toLowerCase() === payout.proof.txid.toLowerCase()
    );
  }
  if (
    args.fundingJournal ||
    args.fundingPlan ||
    args.fundingSigned ||
    m?.funding ||
    m?.fundingSeen ||
    m?.plan ||
    !resolvedPreparation(args.buyerSeed) ||
    !resolvedPreparation(args.counterpartySource)
  )
    return false;
  if (!m) return true;
  return (
    ["draft", "preparing", "wallet_blocked", "expired_unfunded"].includes(
      m.status,
    ) &&
    seconds(args.now) &&
    seconds(m.policy?.validFrom) &&
    args.now >= m.policy.validFrom
  );
}
