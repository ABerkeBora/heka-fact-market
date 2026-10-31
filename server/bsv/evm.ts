import {
  encodeDeployData,
  encodeFunctionData,
  keccak256,
  parseUnits,
  toHex,
  type Hex,
} from "viem";
import { artifact, publicClient, wallet } from "../config.js";
import { read, write, evidence } from "./journal.js";
import { outputsFor, digest } from "./policy.js";
export async function evmAction(id: string, request: any) {
  const signer = wallet("deployer");
  if ((await publicClient.getChainId()) !== 84532)
    throw Error("Base Sepolia test-only proof sidecar");
  let tx: any = read("evm/" + id);
  if (!tx) {
    const req = await signer.prepareTransactionRequest({
      ...request,
      account: signer.account,
      chain: signer.chain,
    });
    if (
      BigInt(req.gas ?? 0) * BigInt(req.maxFeePerGas ?? req.gasPrice ?? 0) >
      50000000000000n
    )
      throw Error("Proof-sidecar gas cap exceeded");
    const raw = await signer.signTransaction(req as any);
    tx = { raw, hash: keccak256(raw), status: "signed" };
    write("evm/" + id, tx);
  }
  let receipt: any;
  try {
    receipt = await publicClient.getTransactionReceipt({ hash: tx.hash });
  } catch {
    try {
      await publicClient.sendRawTransaction({ serializedTransaction: tx.raw });
    } catch {}
    receipt = await publicClient.waitForTransactionReceipt({
      hash: tx.hash,
      timeout: 90000,
    });
  }
  if (receipt.status !== "success")
    throw Error("Proof-sidecar transaction reverted");
  tx.status = "confirmed";
  tx.receipt = receipt;
  write("evm/" + id, tx);
  return { hash: tx.hash, receipt };
}
export async function guard() {
  let d = read("guard");
  if (d) return d;
  const a = artifact("BsvResolutionGuard");
  const tx = await evmAction("guard-deploy", {
    data: encodeDeployData({ abi: a.abi, bytecode: a.bytecode.object }),
  });
  d = {
    address: tx.receipt.contractAddress,
    network: 84532,
    transaction: tx.hash,
  };
  write("guard", d);
  evidence("guard-deployment", d);
  return d;
}
export async function register(p: any) {
  const g = await guard();
  const tx = await evmAction(p.id + "-register", {
    to: g.address,
    data: encodeFunctionData({
      abi: artifact("BsvResolutionGuard").abi,
      functionName: "register",
      args: [
        "0x" + p.policyHash,
        parseUnits((p.thresholdCents / 100).toFixed(2), 18),
        BigInt(p.observationStart),
        BigInt(p.observationEnd),
        ...(["yes", "no", "void"] as const).map(
          (o) => "0x" + digest(outputsFor(p, o)),
        ),
        "0x" + digest(outputsFor(p, "void", false)),
      ],
    }),
  });
  return { guard: g, transaction: tx.hash };
}
export async function bind(p: any, deposits: any[]) {
  const g = await guard();
  const hash = digest(
    deposits.map((d) => ({ txid: d.txid, vout: d.vout, satoshis: d.satoshis })),
  );
  const tx = await evmAction(p.id + "-bind", {
    to: g.address,
    data: encodeFunctionData({
      abi: artifact("BsvResolutionGuard").abi,
      functionName: "bindCollateral",
      args: ["0x" + p.policyHash, "0x" + hash, deposits.length === 2],
    }),
  });
  return { hash, transaction: tx.hash };
}
export async function approve(
  p: any,
  env: any,
  voided = false,
  matched = true,
) {
  const g = await guard();
  const tx = await evmAction(p.id + "-approve", {
    to: g.address,
    data: encodeFunctionData({
      abi: artifact("BsvResolutionGuard").abi,
      functionName: voided ? "approveVoid" : "approve",
      args: voided
        ? ["0x" + p.policyHash]
        : [
            "0x" + p.policyHash,
            BigInt(env.timestamp),
            toHex(env.data),
            env.signature,
          ],
    }),
  });
  const state = (await publicClient.readContract({
    address: g.address,
    abi: artifact("BsvResolutionGuard").abi,
    functionName: "policies",
    args: ["0x" + p.policyHash],
  })) as any;
  const outcome = Number(state[11]);
  const name =
    outcome === 1
      ? "yes"
      : outcome === 2
        ? "no"
        : outcome === 3
          ? "void"
          : null;
  if (!name || state[9] !== "0x" + digest(outputsFor(p, name, matched)))
    throw Error("Unexpected EVM resolution/output approval");
  return {
    guard: g,
    transaction: tx.hash,
    outcome: name,
    outputsHash: state[9],
    proofHash: state[10],
  };
}
