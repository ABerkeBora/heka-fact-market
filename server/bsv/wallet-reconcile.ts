import { createHash } from "node:crypto";
import { BSV } from "./sdk.js";

/** Public historical transactions only; never wallet keys or basket access. */
export type KnownWalletSpend = {
  txid: string;
  raw?: string;
  expectedIdentity?: string;
  /** Only own signed setup transactions acknowledged by the wallet may opt out. */
  requireMined?: boolean;
};
type HistoryWallet = {
  getNetwork(args: object): Promise<{ network: string }>;
  getPublicKey(args: { identityKey: true }): Promise<{ publicKey: string }>;
  listActions(args: {
    labels: string[];
    limit: number;
    offset: number;
    includeInputs: boolean;
    includeOutputs: boolean;
  }): Promise<{
    totalActions: number;
    actions: Array<{
      txid?: string;
      outputs?: Array<{ outputIndex: number; spendable: boolean }>;
    }>;
  }>;
};
export type WalletSpendGate = {
  status: "ready" | "blocked" | "unknown";
  reason: string;
  checkedAt: string;
  conflicts: Array<{ outpoint: string; spentBy: string }>;
  verifiedTransactions: Array<{
    txid: string;
    status: "MINED" | "NETWORK_VISIBLE_UNCONFIRMED";
    blockHash: string | null;
    confirmations: number;
  }>;
  scope: string;
};
const TXID = /^[\da-f]{64}$/i;
const scope =
  "Read-only check of configured canonical spends against standard wallet action history; unconfirmed reservations are explicit, not mining proof; no signing, broadcast, default-basket access or balance assertion";

/**
 * A noSend transaction can be mined externally while a wallet still advertises
 * its inputs as available. Do not let preparation silently spend those inputs
 * again. Repair belongs to the standard wallet, not this application.
 */
export async function inspectKnownWalletSpends(
  wallet: HistoryWallet,
  records: KnownWalletSpend[],
  fetcher: typeof fetch = fetch,
): Promise<WalletSpendGate> {
  const result: WalletSpendGate = {
    status: "unknown",
    reason: "Wallet history has not been verified",
    checkedAt: new Date().toISOString(),
    conflicts: [],
    verifiedTransactions: [],
    scope,
  };
  try {
    if ((await wallet.getNetwork({})).network !== "testnet") {
      return { ...result, status: "blocked", reason: "BSV Testnet required" };
    }
    if (!Array.isArray(records) || records.length > 8)
      throw Error("Expected at most eight public historical transaction records");
    const spent = new Map<string, string>();
    let identity: string | undefined;
    for (const record of records) {
      if (!record || !TXID.test(record.txid))
        throw Error("Invalid configured transaction ID");
      const txid = record.txid.toLowerCase();
      let rawInputs: Array<{ txid: string; vout: number }> | undefined;
      if (record.expectedIdentity) {
        identity ??= (await wallet.getPublicKey({ identityKey: true })).publicKey;
        if (identity !== record.expectedIdentity)
          return {
            ...result,
            status: "blocked",
            reason: "Standard wallet identity differs from the recorded funding wallet",
          };
      }
      if (record.raw !== undefined) {
        if (!/^(?:[\da-f]{2})+$/i.test(record.raw))
          throw Error("Invalid historical raw transaction");
        const first = createHash("sha256")
          .update(Buffer.from(record.raw, "hex"))
          .digest();
        const actual = Buffer.from(createHash("sha256").update(first).digest())
          .reverse()
          .toString("hex");
        if (actual !== txid)
          throw Error("Historical raw transaction does not match its canonical ID");
        const parsed = BSV.Transaction.fromHex(record.raw);
        if (parsed.id("hex") !== txid || parsed.toHex() !== record.raw.toLowerCase())
          throw Error("Historical raw transaction serialization is not canonical");
        rawInputs = parsed.inputs.map((input) => ({
          txid: String(input.sourceTXID).toLowerCase(),
          vout: input.sourceOutputIndex,
        }));
      }
      if (record.requireMined === false && !rawInputs)
        throw Error("An unconfirmed reservation requires its exact signed raw transaction");
      const response = await fetcher(
        "https://api.whatsonchain.com/v1/bsv/test/tx/hash/" + txid,
        { signal: AbortSignal.timeout(15000) },
      );
      if (!response.ok)
        throw Error("Historical transaction lookup HTTP " + response.status);
      const proof: any = await response.json();
      const mined =
        TXID.test(proof.blockhash || "") &&
        Number.isInteger(proof.confirmations) && proof.confirmations >= 1;
      const pending = !proof.blockhash &&
        (proof.confirmations === undefined || proof.confirmations === 0);
      if (
        proof.txid !== txid ||
        (proof.hash !== undefined && proof.hash !== txid) ||
        (!mined && !(record.requireMined === false && pending)) ||
        !Array.isArray(proof.vin) ||
        proof.vin.length === 0
      )
        throw Error("Expected the exact configured transaction with a mined proof");
      if (
        rawInputs &&
        (rawInputs.length !== proof.vin.length || rawInputs.some((input, index) =>
          input.txid !== proof.vin[index].txid?.toLowerCase() ||
          input.vout !== proof.vin[index].vout))
      )
        throw Error("Explorer input metadata does not match the canonical signed transaction");
      result.verifiedTransactions.push({
        txid,
        status: mined ? "MINED" : "NETWORK_VISIBLE_UNCONFIRMED",
        blockHash: mined ? proof.blockhash : null,
        confirmations: mined ? proof.confirmations : 0,
      });
      for (const input of proof.vin) {
        if (
          !TXID.test(input.txid || "") ||
          !Number.isInteger(input.vout) ||
          input.vout < 0 ||
          input.vout > 0xffffffff
        )
          throw Error("Historical transaction has invalid input metadata");
        spent.set(input.txid.toLowerCase() + "." + input.vout, txid);
      }
    }
    // Read the public action history only. A missing user change output can
    // undercount the balance, but must not be fabricated as owned/spendable.
    if (records.length) {
      let offset = 0;
      while (true) {
        const page = await wallet.listActions({
          labels: [],
          limit: 100,
          offset,
          includeInputs: true,
          includeOutputs: true,
        });
        if (
          !Number.isInteger(page.totalActions) ||
          page.totalActions < 0 ||
          page.totalActions > 10000 ||
          !Array.isArray(page.actions)
        )
          throw Error("Wallet action history exceeds the bounded reconciliation check");
        for (const action of page.actions) {
          if (!action.txid) continue;
          for (const output of action.outputs || []) {
            const outpoint = action.txid.toLowerCase() + "." + output.outputIndex;
            const spentBy = spent.get(outpoint);
            if (spentBy && output.spendable)
              result.conflicts.push({ outpoint, spentBy });
          }
        }
        offset += page.actions.length;
        if (offset >= page.totalActions) break;
        if (page.actions.length === 0)
          throw Error("Incomplete wallet history page; do not assume reconciliation");
      }
    }
    return {
      ...result,
      status: result.conflicts.length ? "blocked" : "ready",
      reason: result.conflicts.length
        ? "Wallet still advertises " +
          result.conflicts.length +
          " on-chain-spent source(s). Run the standard wallet's coin reconciliation before preparing a payment."
        : records.length
          ? "Recorded canonical inputs are no longer advertised as spendable. " +
            (result.verifiedTransactions.some((tx) => tx.status === "NETWORK_VISIBLE_UNCONFIRMED")
              ? "An explicitly recorded setup reservation is network-visible but not yet mined. " : "") +
            "Missing historical change is not counted as recovered."
          : "No external wallet spends are configured for reconciliation",
    };
  } catch (error: any) {
    return {
      ...result,
      status: "unknown",
      reason: String(error?.message || error).slice(0, 400),
    };
  }
}
