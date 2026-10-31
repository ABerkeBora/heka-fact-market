/**
 * Read-only native Script checks. No wallet, private journals, value signatures,
 * transaction broadcast or file writes. All fixtures and policies are public.
 *
 * Online: npx tsx scripts/bsv-fast-check.ts --api http://127.0.0.1:3102
 * Offline: npx tsx scripts/bsv-fast-check.ts --market market.json \
 *   --envelope eligible.json --btc authentic-btc.json --stale historical-eth.json
 */
import fs from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import {
  encodePacked,
  keccak256,
  parseUnits,
  toHex,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { BSV } from "../server/bsv/sdk.js";
import { checkFastEnvelope } from "../server/bsv/fast-check.js";
import {
  deriveRequestHash,
  verifySignedResponse,
  type SignedResponse,
} from "../server/airnode.js";

const require = createRequire(import.meta.url),
  { createNodaryFastAsm } = require("../native/fast/consumer-fast-asm.cjs");
const NODARY = "https://airnode-nodary.fly.dev/";
const NODARY_SIGNER = "0xE70f1e8b22a21e4Bb5188918a3033341b281E4c0";
const ETH_REQUEST = {
  operation: "latestFeeds",
  parameters: { name: "ETH/USD" },
  responseProjection: {
    price: "/ETH~1USD/value",
    updatedAt: "/ETH~1USD/timestamp",
  },
};
const BTC_REQUEST = {
  operation: "latestFeeds",
  parameters: { name: "BTC/USD" },
  responseProjection: {
    price: "/BTC~1USD/value",
    updatedAt: "/BTC~1USD/timestamp",
  },
};

export class PendingObservation extends Error {}
const envelopeFrom = (value: any): SignedResponse =>
  value.envelope ?? value.observation?.envelope ?? value;
const readPublic = (filename: string) => JSON.parse(fs.readFileSync(filename, "utf8"));
const scope =
  "Read-only official SDK compiled Script VM using public policy and original envelopes. No wallet accessed, value transaction signed or broadcast, or collateral state changed. Network receipts are separate evidence.";

/** A historical fixture is only a candidate after matching this exact public guard. */
export async function historicalBtcFixture(report: any, market: any): Promise<SignedResponse | undefined> {
  const m = market.market ?? market, policy = m.policy ?? m;
  if (!m.id || report?.status !== "PASS" || report.marketId !== m.id) return;
  const guard = createNodaryFastAsm(policy);
  if (report.lockingScriptSha256 !== guard.info.lockingScriptSha256) return;
  if (m.funding?.txid && report.sourceTXID !== m.funding.txid) return;
  const fixture = report.fixtures?.find((item: any) =>
    item.name === "authentic same-window BTC wrong request" &&
    item.envelope?.requestHash === deriveRequestHash(BTC_REQUEST));
  if (!fixture) return;
  // Neither report labels nor its earlier PASS replace original-signature verification.
  await verifySignedResponse(fixture.envelope, NODARY_SIGNER, deriveRequestHash(BTC_REQUEST));
  return fixture.envelope;
}

/** A changed actual transaction preimage isolates output covenant enforcement. */
function checkProtectedOutput(
  policy: any,
  envelope: SignedResponse,
  sourceTXID: string,
  mutation: "redirect" | "reduce",
) {
  const guard = createNodaryFastAsm(policy),
    yes = parseUnits(String(JSON.parse(envelope.data).price), 18) > BigInt(policy.threshold18),
    expectedScript = yes ? policy.yesRecipientScript : policy.noRecipientScript,
    redirectedScript = "76a914" + "ee".repeat(20) + "88ac";
  if (redirectedScript === expectedScript) throw Error("Output mutation must change its recipient");
  const tx = new BSV.Transaction();
  tx.addInput({ sourceTXID, sourceOutputIndex: 0, sequence: 0xffffffff, unlockingScript: new BSV.UnlockingScript() });
  tx.addOutput({
    satoshis: Number(policy.collateralSatoshis) - (mutation === "reduce" ? 1 : 0),
    lockingScript: BSV.LockingScript.fromHex(mutation === "redirect" ? redirectedScript : expectedScript),
  });
  const preimage = BSV.TransactionSignature.format({
    sourceTXID,
    sourceOutputIndex: 0,
    sourceSatoshis: Number(policy.collateralSatoshis),
    transactionVersion: tx.version,
    otherInputs: [],
    inputIndex: 0,
    outputs: tx.outputs,
    inputSequence: 0xffffffff,
    subscript: BSV.LockingScript.fromHex(guard.postSeparatorScriptHex),
    lockTime: 0,
    scope: 0x41,
  });
  const unlock = BSV.UnlockingScript.fromHex(guard.unlock({ envelope, preimageHex: BSV.Utils.toHex(preimage) }));
  const started = Date.now();
  let accepted = false, reason = "";
  try {
    accepted = new BSV.Spend({
      sourceTXID,
      sourceOutputIndex: 0,
      sourceSatoshis: Number(policy.collateralSatoshis),
      lockingScript: BSV.LockingScript.fromHex(guard.lockingHex),
      transactionVersion: tx.version,
      otherInputs: [],
      inputIndex: 0,
      unlockingScript: unlock,
      outputs: tx.outputs,
      inputSequence: 0xffffffff,
      lockTime: 0,
      memoryLimit: 100_000_000,
    }).validate();
  } catch (error: any) {
    reason = String(error.message).slice(0, 400);
  }
  return { accepted, reason: reason || (accepted ? "Unexpected output accepted" : "Output covenant rejected"), durationMs: Date.now() - started };
}

export async function runFastChecks(input: {
  market: any;
  valid: SignedResponse;
  stale: SignedResponse;
  btc: SignedResponse;
}) {
  const m = input.market.market ?? input.market,
    policy = m.policy ?? m,
    sourceTXID = m.funding?.txid ?? "00".repeat(32),
    valid = input.valid,
    stale = input.stale,
    btc = input.btc;
  const signer = policy.expectedAirnodeAddress as `0x${string}`;
  if (signer.toLowerCase() !== NODARY_SIGNER.toLowerCase() || policy.requestHash !== deriveRequestHash(ETH_REQUEST))
    throw Error("These checks require the pinned original Nodary ETH/USD source");
  const guard = createNodaryFastAsm(policy),
    expectedScriptHash = m.funding?.scriptInfo?.lockingScriptSha256;
  if (expectedScriptHash && expectedScriptHash !== guard.info.lockingScriptSha256)
    throw Error("The public funding script commitment does not match this policy/template");
  await verifySignedResponse(valid, signer, policy.requestHash);
  await verifySignedResponse(stale, signer, policy.requestHash);
  await verifySignedResponse(btc, signer, deriveRequestHash(BTC_REQUEST));
  const eligible = (e: SignedResponse) => {
    const signedAt = Number(e.timestamp), sourceAt = Math.floor(Number(JSON.parse(e.data).updatedAt) / 1000);
    return signedAt >= Number(policy.validFrom) && signedAt <= Number(policy.validTo) &&
      sourceAt >= Number(policy.validFrom) && sourceAt <= Number(policy.validTo) &&
      sourceAt <= signedAt + 5 && signedAt <= sourceAt + 120;
  };
  if (!eligible(valid)) throw new PendingObservation("The positive original envelope is not eligible for this immutable observation window");
  if (!eligible(btc)) throw new PendingObservation("Need a genuine BTC envelope from the same eligible interval to isolate wrong-request rejection");
  if (Number(stale.timestamp) >= Number(policy.validFrom) && Number(stale.timestamp) <= Number(policy.validTo))
    throw Error("The stale fixture must have an original signature timestamp outside this policy window");

  const edited = { ...valid, data: valid.data.replace(/("price"\s*:\s*)(\d+)(\.\d+)?/, (_match, prefix, integer, fraction) => prefix + (BigInt(integer) + 1n).toString() + (fraction ?? "")) };
  if (edited.data === valid.data) throw Error("Price edit did not change the signed original data");
  // This ephemeral key signs only an off-chain test message, never a value transaction.
  const outsider = privateKeyToAccount(generatePrivateKey());
  const digest = keccak256(encodePacked(["bytes32", "uint256", "bytes"], [valid.requestHash, BigInt(valid.timestamp), toHex(valid.data)]));
  const wrongKey = {
    ...valid,
    airnode: outsider.address,
    signature: await outsider.signMessage({ message: { raw: digest } }),
  };
  const fixtures: { name: string; expectedAccepted: boolean; envelope: SignedResponse }[] = [
    { name: "valid original eligible ETH/USD", expectedAccepted: true, envelope: valid },
    { name: "edited raw price with unchanged signature", expectedAccepted: false, envelope: edited },
    { name: "authentic original stale ETH/USD", expectedAccepted: false, envelope: stale },
    { name: "authentic same-window BTC wrong request", expectedAccepted: false, envelope: btc },
    { name: "exact request and data signed by ephemeral wrong key", expectedAccepted: false, envelope: wrongKey },
  ];
  const results: any[] = fixtures.map((fixture) => {
    const result = checkFastEnvelope(policy, fixture.envelope, sourceTXID);
    return { ...fixture, ...result, pass: result.accepted === fixture.expectedAccepted };
  });
  for (const mutation of ["redirect", "reduce"] as const) {
    const result = checkProtectedOutput(policy, valid, sourceTXID, mutation);
    results.push({ name: mutation === "redirect" ? "cannot redirect the protected payout" : "cannot reduce protected collateral for fees", expectedAccepted: false, ...result, pass: !result.accepted });
  }
  return {
    status: results.every((result) => result.pass) ? "PASS" : "FAIL",
    checkedAt: new Date().toISOString(),
    network: "testnet",
    marketId: m.id ?? null,
    sourceTXID,
    lockingScriptSha256: guard.info.lockingScriptSha256,
    fundingScriptCommitmentMatched: expectedScriptHash ? true : null,
    policy,
    scope,
    fixtures: results,
    protectedState: "Read-only checks did not submit any transaction or alter the protected funding output",
  };
}

async function jsonRequest(url: string, init?: RequestInit) {
  const r = await fetch(url, { ...init, signal: AbortSignal.timeout(25000) });
  if (!r.ok) throw Error(`Public read HTTP${r.status}`);
  const text = await r.text();
  if (Buffer.byteLength(text) > 1_048_576) throw Error("Public fixture response exceeds bound");
  return JSON.parse(text);
}

async function main() {
  const options = new Map<string, string>();
  for (let i = 2; i < process.argv.length; i += 2) {
    const key = process.argv[i], value = process.argv[i + 1];
    if (!key || !value || !["--api", "--market", "--envelope", "--btc", "--stale"].includes(key)) throw Error("Use --api http://127.0.0.1:3102, or --market public.json --envelope valid.json --btc btc.json [--stale stale.json]");
    options.set(key, value);
  }
  let state: any;
  if (options.has("--api")) {
    const base = options.get("--api")!.replace(/\/$/, "");
    if (!/^http:\/\/(?:127\.0\.0\.1|localhost):3102$/.test(base)) throw Error("The optional API read is restricted to the local Fact Market service on port3102");
    state = await jsonRequest(base + "/api/bsv/fast/state");
  }
  // judgeSample is paired with judgeMarket, which can be the last paid archive
  // while the current market exercises the independent no-data refund path.
  const apiMarket = state?.judgeMarket ?? state?.market;
  const market = options.has("--market") ? readPublic(options.get("--market")!) : apiMarket;
  if (!market) {
    if (options.has("--api")) throw new PendingObservation("No public market with an eligible observation is available yet");
    throw Error("A public market/policy is required");
  }
  const valid = options.has("--envelope") ? envelopeFrom(readPublic(options.get("--envelope")!))
    : options.has("--market") ? market.finalObservation?.envelope
    : state?.judgeSample ?? market.finalObservation?.envelope;
  if (!valid) throw new PendingObservation("No eligible original observation has been captured yet");
  const stale = envelopeFrom(readPublic(options.get("--stale") ?? "native/fast/fixture.json"));
  let btc: SignedResponse | null | undefined;
  let btcSource: any;
  if (options.has("--btc")) {
    btc = envelopeFrom(readPublic(options.get("--btc")!));
    btcSource = { kind: "explicit-public-file", path: options.get("--btc") };
  } else if (options.has("--api")) {
    const reportPath = "docs/evidence/bsv/fast-live-tamper.json";
    if (fs.existsSync(reportPath)) {
      const report = readPublic(reportPath);
      btc = await historicalBtcFixture(report, market);
      if (btc) btcSource = {
        kind: "historical-public-report",
        path: reportPath,
        marketId: report.marketId,
        reportCheckedAt: report.checkedAt,
        scope: "Original response from this immutable historical window; not a current quote or a new network payment",
      };
    }
    if (!btc) {
      btc = await jsonRequest(NODARY, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(BTC_REQUEST) });
      btcSource = { kind: "fresh-provider-read", endpoint: NODARY };
    }
  }
  if (!btc) throw Error("Offline checks require an authentic --btc fixture");
  const result = await runFastChecks({ market, valid, stale, btc });
  console.log(JSON.stringify({ ...result, fixtureSources: { btc: btcSource } }, null, 2));
  if (result.status !== "PASS") process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: any) => {
    const waiting = error instanceof PendingObservation;
    console.log(JSON.stringify({ status: waiting ? "WAITING_FOR_ELIGIBLE_OBSERVATION" : "FAIL", reason: error.message, scope }, null, 2));
    process.exitCode = waiting ? 2 : 1;
  });
}
