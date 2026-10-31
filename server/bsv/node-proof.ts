import { createHash } from "node:crypto";
import { BSV } from "./sdk.js";

export const GORILLA = "https://testnet.gorillanode.io/api/v1";
const PROVIDERS = new Set([
  GORILLA,
  "https://teranode-eks-testnet-eu-1.bsvb.tech/api/v1",
  "http://bsva-ovh-seed-testnet-us-1.bsvb.tech:8000/api/v1",
]);
const HASH = /^[\da-f]{64}$/i;
const sha = (data: Uint8Array) => createHash("sha256").update(data).digest("hex");

export type NodeValidationProof = {
  status: "VALIDATED_BY_NODE_UTXO";
  network: "testnet";
  txid: string;
  provider: string;
  http: 200;
  rawMatchesOriginal: true;
  rawBinding: "canonical-transaction-id";
  validatedInputs: true;
  validatedOutputs: true;
  inputCount: number;
  outputCount: number;
  totalOutputCount: number;
  inputs: Array<{
    inputIndex: number;
    sourceTxid: string;
    vout: number;
    status: 1;
    spendingTxid: string;
    vin: number;
  }>;
  outputs: Array<{
    outputIndex: number;
    status: 0 | 1;
    satoshis: number;
    scriptSha256: string;
    spendingTxid?: string;
    vin?: number;
  }>;
  txMeta: {
    txid: string;
    fee: number;
    sizeInBytes: number;
    blockIDs: number[];
    blockHashes: string[];
    blockHeights: number[];
    mainChainIndex: number;
  };
  miningStatus: "UNCONFIRMED" | "MINED";
  blockHash?: string;
  blockHeight?: number;
  checkedAt: string;
  scope: string;
};

/**
 * A propagation HTTP200 can precede validation. Only accept the node's actual
 * spent-input and created-output UTXO state, bound to the supplied canonical
 * transaction ID. This is node execution evidence, not a block/finality proof.
 * No raw transaction, key or signing request is sent to any endpoint.
 */
export async function inspectNodeValidatedTransaction(
  rawHex: string,
  provider = GORILLA,
  fetcher: typeof fetch = fetch,
): Promise<NodeValidationProof | null> {
  provider = provider.replace(/\/$/, "");
  if (!PROVIDERS.has(provider)) throw Error("Only configured public BSV Testnet nodes are allowed");
  if (!/^(?:[\da-f]{2})+$/i.test(rawHex) || rawHex.length / 2 > 16 * 1024 * 1024)
    throw Error("A bounded canonical raw transaction is required");
  const tx = BSV.Transaction.fromHex(rawHex);
  if (tx.toHex() !== rawHex.toLowerCase()) throw Error("Transaction serialization is not canonical");
  const txid = tx.id("hex");
  const positiveOutputs = tx.outputs.map((output, outputIndex) => ({ output, outputIndex }))
    .filter(({ output }) => Number(output.satoshis) > 0);
  if (!tx.inputs.length || !positiveOutputs.length || tx.inputs.length > 32 || positiveOutputs.length > 32)
    throw Error("Node proof is limited to 1–32 inputs and positive outputs");
  for (const input of tx.inputs)
    if (!HASH.test(input.sourceTXID || "") || !Number.isInteger(input.sourceOutputIndex) || input.sourceOutputIndex < 0)
      throw Error("Invalid canonical input outpoint");
  for (const { output } of positiveOutputs)
    if (!Number.isSafeInteger(output.satoshis)) throw Error("Invalid canonical output amount");

  const deadline = AbortSignal.timeout(20000);
  async function get(path: string, maxBytes = 64 * 1024): Promise<any | null> {
    let response: Response;
    try {
      response = await fetcher(provider + "/" + path, {
        method: "GET", headers: { Accept: "application/json", "Cache-Control": "no-cache" }, signal: deadline,
      });
    } catch { return null; }
    if ([202, 404, 408, 425, 429, 500, 502, 503, 504].includes(response.status)) return null;
    if (!response.ok) throw Error("Node validation lookup HTTP " + response.status);
    if (!response.body) return null;
    let total = 0;
    const parts: Uint8Array[] = [];
    try {
      for await (const chunk of response.body) {
        total += chunk.length;
        if (total > maxBytes) throw Error("Node validation response exceeds byte limit");
        parts.push(chunk);
      }
    } catch (error: any) {
      if (deadline.aborted || error?.name === "AbortError") return null;
      throw error;
    }
    try { return JSON.parse(Buffer.concat(parts).toString("utf8")); }
    catch { throw Error("Node validation lookup returned invalid JSON"); }
  }
  const meta = await get("txmeta/" + txid + "/json", 16 * 1024 * 1024);
  if (!meta || !meta.tx) return null;
  if (meta.tx.txid !== txid) throw Error("Node transaction metadata identifies another transaction");
  if (meta.sizeInBytes !== rawHex.length / 2 || !Number.isSafeInteger(meta.fee) || meta.fee < 0)
    throw Error("Node transaction metadata does not match canonical size/fee context");
  const requests = [
    ...tx.inputs.map((input) => "utxo/" + input.sourceTXID + "/json?vout=" + input.sourceOutputIndex),
    ...positiveOutputs.map(({ outputIndex }) => "utxo/" + txid + "/json?vout=" + outputIndex),
  ];
  // Cap concurrent GETs independently of the transaction's bounded item count.
  const answers: any[] = new Array(requests.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(4, requests.length) }, async () => {
    while (next < requests.length) { const index = next++; answers[index] = await get(requests[index]); }
  }));
  const inputs: NodeValidationProof["inputs"] = [];
  const outputs: NodeValidationProof["outputs"] = [];
  let pending = false;
  const identity = (data: any, expected: string, vout: number) => {
    if (!data || typeof data !== "object" || Array.isArray(data)) throw Error("Invalid node UTXO response");
    for (const key of ["txid", "txId"]) if (data[key] !== undefined && data[key] !== expected)
      throw Error("Node UTXO response identifies another transaction");
    for (const key of ["vout", "outputIndex"]) if (data[key] !== undefined && data[key] !== vout)
      throw Error("Node UTXO response identifies another output");
    if (!Number.isInteger(data.status)) throw Error("Node UTXO response has no explicit status");
  };
  const spender = (data: any) => {
    const spending = data.spendingData;
    if (!spending || !HASH.test(spending.txId || "") || !Number.isInteger(spending.vin) || spending.vin < 0)
      throw Error("Spent node UTXO lacks a canonical spending reference");
    return { spendingTxid: spending.txId.toLowerCase(), vin: spending.vin };
  };
  for (let index = 0; index < tx.inputs.length; index++) {
    const input = tx.inputs[index], data = answers[index];
    if (!data) { pending = true; continue; }
    identity(data, input.sourceTXID!, input.sourceOutputIndex);
    if ([0, 3, 7].includes(data.status)) { pending = true; continue; }
    if (data.status !== 1) throw Error("Node input UTXO rejected or unavailable, status " + data.status);
    const spent = spender(data);
    if (spent.spendingTxid !== txid)
      throw Error("Canonical input was spent by another transaction");
    if (spent.vin !== index)
      throw Error("Canonical input spend vin does not match transaction input");
    inputs.push({ inputIndex: index, sourceTxid: input.sourceTXID!, vout: input.sourceOutputIndex, status: 1, ...spent });
  }
  for (let index = 0; index < positiveOutputs.length; index++) {
    const { output, outputIndex } = positiveOutputs[index], data = answers[tx.inputs.length + index];
    if (!data) { pending = true; continue; }
    identity(data, txid, outputIndex);
    if ([3, 7].includes(data.status)) { pending = true; continue; }
    if (![0, 1].includes(data.status)) throw Error("Node output UTXO rejected or unavailable, status " + data.status);
    if (data.status === 0 && data.spendingData) throw Error("Node reports contradictory output spend state");
    outputs.push({ outputIndex, status: data.status, satoshis: Number(output.satoshis),
      scriptSha256: sha(Uint8Array.from(output.lockingScript.toBinary())),
      ...(data.status === 1 ? spender(data) : {}),
    });
  }
  if (pending) return null;
  const blockIDs = Array.isArray(meta.blockIDs) ? meta.blockIDs : [];
  const blockHashes = Array.isArray(meta.blockHashes) ? meta.blockHashes : [];
  const blockHeights = Array.isArray(meta.blockHeights) ? meta.blockHeights : [];
  const mainChainIndex = Number.isInteger(meta.mainChainIndex) ? meta.mainChainIndex : -1;
  const mined = mainChainIndex >= 0 && mainChainIndex < blockIDs.length &&
    HASH.test(blockHashes[mainChainIndex] || "") && Number.isSafeInteger(blockHeights[mainChainIndex]) &&
    blockHeights[mainChainIndex] > 0;
  return {
    status: "VALIDATED_BY_NODE_UTXO", network: "testnet", txid, provider, http: 200,
    rawMatchesOriginal: true, rawBinding: "canonical-transaction-id", validatedInputs: true, validatedOutputs: true,
    inputCount: tx.inputs.length, outputCount: positiveOutputs.length, totalOutputCount: tx.outputs.length,
    inputs, outputs, txMeta: { txid, fee: meta.fee, sizeInBytes: meta.sizeInBytes,
      blockIDs, blockHashes, blockHeights, mainChainIndex },
    miningStatus: mined ? "MINED" : "UNCONFIRMED",
    ...(mined ? { blockHash: blockHashes[mainChainIndex], blockHeight: blockHeights[mainChainIndex] } : {}),
    checkedAt: new Date().toISOString(),
    scope: "Canonical node UTXO spend/create state after validation; this observation is not retroactive prefunding evidence or a block/finality guarantee",
  };
}
