import { createHash } from "node:crypto";
import { BSV } from "./sdk.js";
export const PROTOCOL = [1, "fact market bsv"] as const;
export const STAKE = 1000,
  SETTLEMENT_FEE = 100;
export function canonical(value: any): string {
  return JSON.stringify(
    value && typeof value === "object" && !Array.isArray(value)
      ? Object.fromEntries(
          Object.keys(value)
            .sort()
            .map((k) => [k, JSON.parse(canonical(value[k]))]),
        )
      : Array.isArray(value)
        ? value.map((x) => JSON.parse(canonical(x)))
        : value,
  );
}
export const digest = (value: any) =>
  createHash("sha256")
    .update(typeof value === "string" ? value : canonical(value))
    .digest("hex");
export type Output = { satoshis: number; lockingScript: string };
export function payoutScript(pub: string) {
  return new BSV.P2PKH().lock(BSV.PublicKey.fromString(pub).toHash()).toHex();
}
export function outputsFor(
  p: any,
  outcome: "yes" | "no" | "void",
  matched = true,
): Output[] {
  if (!matched)
    return [
      {
        satoshis: STAKE - SETTLEMENT_FEE,
        lockingScript: payoutScript(p.userSide === "yes" ? p.yesPub : p.noPub),
      },
    ];
  if (outcome === "void")
    return [
      {
        satoshis: STAKE - SETTLEMENT_FEE / 2,
        lockingScript: payoutScript(p.yesPub),
      },
      {
        satoshis: STAKE - SETTLEMENT_FEE / 2,
        lockingScript: payoutScript(p.noPub),
      },
    ];
  return [
    {
      satoshis: STAKE * 2 - SETTLEMENT_FEE,
      lockingScript: payoutScript(outcome === "yes" ? p.yesPub : p.noPub),
    },
  ];
}
/** Trusted oracle attestor AND one fixed beneficiary. Both signatures commit ALL outputs. */
export function collateralScript(p: any) {
  return BSV.LockingScript.fromASM(
    `${p.policyHash} OP_DROP ${p.attestorPub} OP_CHECKSIGVERIFY OP_IF ${p.yesPub} OP_CHECKSIG OP_ELSE ${p.noPub} OP_CHECKSIG OP_ENDIF`,
  ).toHex();
}
export function assertPolicy(p: any) {
  if (
    p.network !== "testnet" ||
    p.stakeSats !== STAKE ||
    p.feeSats !== SETTLEMENT_FEE
  )
    throw Error("Only pinned testnet stake and settlement fee are allowed");
  for (const key of ["yesPub", "noPub", "attestorPub"])
    if (
      !/^(02|03)[\da-f]{64}$/i.test(p[key]) ||
      !BSV.PublicKey.fromString(p[key]).validate()
    )
      throw Error("Invalid derived public key");
  if (new Set([p.yesPub, p.noPub, p.attestorPub]).size !== 3)
    throw Error("Participants and attestor must use distinct keys");
  if (
    !Number.isSafeInteger(p.thresholdCents) ||
    p.thresholdCents <= 0 ||
    p.closesAt >= p.observationStart ||
    p.observationStart >= p.observationEnd
  )
    throw Error("Invalid immutable market rule");
  const { policyHash, ...fields } = p;
  if (policyHash !== digest(fields)) throw Error("Policy hash mismatch");
  return p;
}
export function validateOutputs(
  p: any,
  outcome: "yes" | "no" | "void",
  tx: InstanceType<typeof BSV.Transaction>,
  matched = true,
) {
  const expected = outputsFor(p, outcome, matched);
  if (
    tx.outputs.length !== expected.length ||
    tx.outputs.some(
      (o, i) =>
        o.satoshis !== expected[i]!.satoshis ||
        o.lockingScript.toHex() !== expected[i]!.lockingScript,
    )
  )
    throw Error("Payout outputs do not match the immutable outcome");
  if (tx.inputs.length !== (matched ? 2 : 1))
    throw Error("Payout must spend the exact funded pool");
  return digest(expected);
}
export function signatureHash(
  tx: InstanceType<typeof BSV.Transaction>,
  index: number,
) {
  const input = tx.inputs[index]!,
    source = input.sourceTransaction?.outputs[input.sourceOutputIndex];
  if (!source) throw Error("Missing authenticated source transaction");
  const scope =
    BSV.TransactionSignature.SIGHASH_ALL |
    BSV.TransactionSignature.SIGHASH_FORKID;
  const preimage = BSV.TransactionSignature.format({
    sourceTXID: input.sourceTXID ?? input.sourceTransaction!.id("hex"),
    sourceOutputIndex: input.sourceOutputIndex,
    sourceSatoshis: source.satoshis!,
    transactionVersion: tx.version,
    otherInputs: tx.inputs.filter((_, i) => i !== index),
    inputIndex: index,
    outputs: tx.outputs,
    inputSequence: input.sequence ?? 0xffffffff,
    subscript: source.lockingScript,
    lockTime: tx.lockTime,
    scope,
  });
  return { hash: BSV.Hash.hash256(preimage), scope };
}
export function txSignature(der: number[], scope: number) {
  const s = BSV.Signature.fromDER(der);
  return new BSV.TransactionSignature(s.r, s.s, scope).toChecksigFormat();
}
