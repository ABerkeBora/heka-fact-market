/** Explicit testnet fee sponsorship. Importing this module never contacts a wallet. */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { BSV } from "../server/bsv/sdk.js";
import { inspectNodeValidatedTransaction } from "../server/bsv/node-proof.js";
import { isAcceptedProof } from "../server/bsv/fast-state.js";
const require = createRequire(import.meta.url);
const { createNodaryFastAsm, verifyRaw } = require("../native/fast/consumer-fast-asm.cjs");
const ARTIFACT = "bd453a9cd9e9fff72ad98422d23af94407506ae8be584e95640339b1b0e85591";
const SIGNER = "0xe70f1e8b22a21e4bb5188918a3033341b281e4c0";
const REQUEST = "0x180eae9387bb66a72380e61ebe0a00d19f8414a716a37ebe1df124b66acfff66";
const KEY = "native-fast-fee-sponsor-v1";
const p2pkh = (s: unknown) => typeof s === "string" && /^76a914[0-9a-f]{40}88ac$/i.test(s);
const feeOf = (tx: any) => tx.inputs.reduce((n: number, i: any) => n + i.sourceTransaction.outputs[i.sourceOutputIndex].satoshis, 0) - tx.outputs.reduce((n: number, o: any) => n + o.satoshis, 0);
const planHash = (raw: string) => createHash("sha256").update(raw).digest("hex");
function validInputs(tx: any, indexes: number[]) {
    for (const index of indexes) {
        const i = tx.inputs[index], o = i.sourceTransaction.outputs[i.sourceOutputIndex];
        if (!i.unlockingScript || !new BSV.Spend({ sourceTXID: i.sourceTXID, sourceOutputIndex: i.sourceOutputIndex, sourceSatoshis: o.satoshis, lockingScript: o.lockingScript, transactionVersion: tx.version, otherInputs: tx.inputs.filter((_: any, j: number) => j !== index), outputs: tx.outputs, inputIndex: index, unlockingScript: i.unlockingScript, inputSequence: i.sequence ?? 0xffffffff, lockTime: tx.lockTime }).validate())
            throw Error(`Funding input ${index} signature invalid`);
    }
}
/** Pure local validation: no wallet calls, no broadcast, no journal changes. */
export function validateFastSponsorPlan(plan: any, source: any, now = Math.floor(Date.now() / 1000)) {
    if (plan.network !== "testnet" || source.network !== "testnet" || plan.sponsorInputIndex !== 2 || plan.returnOutputIndex !== 2 || plan.feeSatoshis !== 2000 || ![6000, 4000].includes(source.satoshis) || source.requiredReturnSatoshis !== source.satoshis - 2000 || source.maxFeeSatoshis !== 2000 || source.requiredEscrowSatoshis !== 2000)
        throw Error("Bounded fast testnet source/fee policy required");
    const p = plan.policy;
    if (!p || ![p.validFrom, p.validTo, p.refundAfter].every(Number.isSafeInteger) || p.validFrom > now + 1800 || p.refundAfter > p.validTo + 600)
        throw Error("Bounded integer observation/refund times required");
    if (p.expectedAirnodeAddress?.toLowerCase() !== SIGNER || p.requestHash?.toLowerCase() !== REQUEST || Number(p.collateralSatoshis) !== 2000 || Number(p.buyerStakeSatoshis) !== 1000 || !(p.validFrom > now) || !(p.validTo >= p.validFrom) || p.validTo - p.validFrom > 900 || !(p.refundAfter > p.validTo))
        throw Error("Pinned original source, future bounded window and fixed stakes required");
    const recipients = [p.refundBuyerScript, p.refundCounterpartyScript];
    if (!recipients.every(p2pkh) || new Set(recipients).size !== 2 || new Set([p.yesRecipientScript, p.noRecipientScript]).size !== 2 || !recipients.includes(p.yesRecipientScript) || !recipients.includes(p.noRecipientScript) || !p2pkh(source.lockingScript) || source.returnLockingScript !== source.lockingScript)
        throw Error("Two distinct participant recipients and owned sponsor return required");
    const guard = createNodaryFastAsm(p);
    if (guard.info.artifactSha256 !== ARTIFACT || guard.info.nonPushOpcodes >= 1000000)
        throw Error("Frozen optimized native artifact required");
    const tx = BSV.Transaction.fromHex(plan.partialRaw);
    if (tx.version !== 1 || tx.inputs.length !== 3 || tx.outputs.length !== 3 || plan.sources?.length !== 3 || new Set(plan.sources.map((s: any) => s.inputIndex)).size !== 3)
        throw Error("Exactly three distinct funding sources required");
    for (const s of plan.sources) {
        if (![0, 1, 2].includes(s.inputIndex) || !Array.isArray(s.beef))
            throw Error("Each source must supply its exact public Atomic BEEF");
        const parent = BSV.Transaction.fromAtomicBEEF(s.beef), i = tx.inputs[s.inputIndex];
        if (i.sourceTXID !== parent.id("hex") || !parent.outputs[i.sourceOutputIndex])
            throw Error("Source outpoint/BEEF mismatch");
        i.sourceTransaction = parent;
    }
    if (new Set(tx.inputs.map((i: any) => `${i.sourceTXID}:${i.sourceOutputIndex}`)).size !== 3 || tx.inputs.some((i: any) => i.sequence !== 0xffffffff) || tx.lockTime !== 0)
        throw Error("Duplicate inputs or unexpected funding lock time/sequence");
    const inp = tx.inputs[2], prev = inp.sourceTransaction!.outputs[inp.sourceOutputIndex];
    if (inp.sourceTXID !== source.txid || inp.sourceOutputIndex !== source.vout || prev.satoshis !== source.satoshis || prev.lockingScript.toHex() !== source.lockingScript)
        throw Error("Sponsor does not spend its exact configured source");
    const participantSources = tx.inputs.slice(0, 2).map((i: any) => i.sourceTransaction.outputs[i.sourceOutputIndex]);
    if (participantSources[0].satoshis !== 1000 || participantSources[0].lockingScript.toHex() !== p.refundBuyerScript || participantSources[1].satoshis !== 1900 || !p2pkh(participantSources[1].lockingScript.toHex()) || participantSources[0].lockingScript.toHex() === participantSources[1].lockingScript.toHex())
        throw Error("Buyer and opposing source ownership/amounts changed");
    const expected = [{ satoshis: 2000, script: guard.lockingHex }, { satoshis: 900, script: p.refundCounterpartyScript }, { satoshis: source.satoshis - 2000, script: source.returnLockingScript }];
    if (tx.outputs.some((o: any, i: number) => o.satoshis !== expected[i].satoshis || o.lockingScript.toHex() !== expected[i].script) || feeOf(tx) !== 2000)
        throw Error("Immutable pool, external fee change or sponsor return changed");
    validInputs(tx, [0, 1]);
    return { tx, guard };
}
export async function main(args = process.argv.slice(2)) {
    const [command, arg] = args;
    if (!["seed-fast", "sign-fast", "reuse-change"].includes(command))
        throw Error("Use seed-fast --accept-testnet-seed-6000-fee-cap-500 | sign-fast <funding-plan.json> | reuse-change <accepted-first-payout-txid>");
    if (command === "seed-fast" && arg !== "--accept-testnet-seed-6000-fee-cap-500")
        throw Error("Explicit6000test-sat seed and500sat fee-cap acknowledgment required");
    const { acquireProcessLock } = await import("../server/lock.js");
    acquireProcessLock("server");
    const { userWallet, testWallet } = await import("../server/bsv/wallets.js");
    const { read, write } = await import("../server/bsv/journal.js");
    const { PROTOCOL, payoutScript, signatureHash, txSignature } = await import("../server/bsv/policy.js");
    const w = await testWallet(userWallet), pub = (await w.getPublicKey({ protocolID: PROTOCOL, keyID: KEY, counterparty: "anyone", forSelf: true })).publicKey, script = payoutScript(pub);
    let ledger = read<any>("fast/sponsor-allocations", { network: "testnet", maxPools: 2, signatures: [] });
    if (ledger.network !== "testnet" || ledger.maxPools !== 2 || !Array.isArray(ledger.signatures))
        throw Error("Invalid sponsor allocation journal");
    if (command === "seed-fast") {
        if (ledger.signatures.length !== 0)
            throw Error("Existing native funding allocation cannot receive another seed");
        if (read("fast/fee-sponsor-public") || read("fast/sponsor-seed"))
            throw Error("Existing source or uncertain seed must be reconciled; never replace it");
        write("fast/sponsor-seed", { status: "requested", network: "testnet", satoshis: 6000 });
        const action = await w.createAction({ description: "Prepare native market fee source", outputs: [{ lockingScript: script, satoshis: 6000, outputDescription: "Own bounded native funding fees", basket: "fact-market-fast-fee", customInstructions: JSON.stringify({ protocolID: PROTOCOL, keyID: KEY, counterparty: "anyone" }) }], options: { signAndProcess: false, randomizeOutputs: false, acceptDelayedBroadcast: false } });
        if (!action.signableTransaction)
            throw Error("Missing signable seed; reconcile existing wallet action");
        const tx = BSV.Transaction.fromAtomicBEEF(action.signableTransaction.tx), fee = feeOf(tx);
        if (!Number.isSafeInteger(fee) || fee < 0 || fee > 500 || tx.outputs.filter((o: any) => o.satoshis === 6000 && o.lockingScript.toHex() === script).length !== 1)
            throw Error("Seed output/fee cap mismatch; no signing");
        write("fast/sponsor-seed", { status: "prepared", network: "testnet", reference: action.signableTransaction.reference, feeSats: fee });
        const signed = await w.signAction({ reference: action.signableTransaction.reference, spends: {}, options: { acceptDelayedBroadcast: false } });
        if (!signed.tx || !signed.txid)
            throw Error("Signing outcome uncertain; do not prepare a replacement");
        const parent = BSV.Transaction.fromAtomicBEEF(signed.tx), vout = parent.outputs.findIndex((o: any) => o.satoshis === 6000 && o.lockingScript.toHex() === script);
        if (parent.id("hex") !== signed.txid || vout < 0)
            throw Error("Signed seed mismatch");
        const source = { network: "testnet", txid: signed.txid, sourceBeef: Array.from(signed.tx), vout, satoshis: 6000, lockingScript: script, returnLockingScript: script, requiredReturnSatoshis: 4000, maxFeeSatoshis: 2000, requiredEscrowSatoshis: 2000 };
        write("fast/sponsor-seed", { ...source, beef: source.sourceBeef, status: "signed", feeSats: fee });
        write("fast/fee-sponsor-public", source);
        console.log(JSON.stringify({ txid: signed.txid, feeSats: fee, status: "Own testnet fee source prepared; verify network acceptance before a new pool" }));
        return;
    }
    if (command === "reuse-change") {
        if (ledger.signatures.length !== 1 || !/^[0-9a-f]{64}$/i.test(arg || ""))
            throw Error("One first funding and an explicit accepted payout hash required");
        const first = ledger.signatures[0], funding = BSV.Transaction.fromAtomicBEEF(first.beef);
        if (funding.id("hex") !== first.txid || funding.outputs[2].satoshis !== 4000 || funding.outputs[2].lockingScript.toHex() !== script)
            throw Error("First sponsor change mismatch");
        const url = "https://api.whatsonchain.com/v1/bsv/test/tx/" + arg + "/hex", response = await fetch(url, { signal: AbortSignal.timeout(15000) });
        if (!response.ok)
            throw Error("First payout is not independently network-visible; second pool blocked");
        const raw = (await response.text()).replace(/^"|"$/g, "").trim(), claim = BSV.Transaction.fromHex(raw);
        if (claim.id("hex") !== arg || claim.inputs[0]?.sourceTXID !== first.txid || claim.inputs[0]?.sourceOutputIndex !== 0 || claim.outputs[0]?.satoshis !== 2000 || ![first.policy.yesRecipientScript, first.policy.noRecipientScript].includes(claim.outputs[0].lockingScript.toHex()))
            throw Error("Receipt is not the first native outcome payout");
        if (!verifyRaw({ policy: first.policy, rawTransaction: raw, inputIndex: 0, sourceSatoshis: 2000 }).success)
            throw Error("First payout does not satisfy the original native guard");
        const proof = await inspectNodeValidatedTransaction(raw);
        if (!proof || !isAcceptedProof(proof) || proof.txid !== arg)
            throw Error("First native outcome validation remains unproven; raw visibility cannot unlock a second pool");
        const source = { network: "testnet", txid: first.txid, vout: 2, sourceBeef: first.beef, satoshis: 4000, lockingScript: script, returnLockingScript: script, requiredReturnSatoshis: 2000, maxFeeSatoshis: 2000, requiredEscrowSatoshis: 2000, afterAcceptedPayout: proof };
        write("fast/fee-sponsor-public", source);
        ledger.firstPayout = proof;
        write("fast/sponsor-allocations", ledger);
        console.log(JSON.stringify({ status: "First outcome independently verified; exact4000sat sponsor change available", sourceTxid: first.txid, payoutTxid: arg }));
        return;
    }
    if (!arg)
        throw Error("Funding plan path required");
    const filename = path.resolve(arg), allowed = path.resolve(".local/bsv/fast/funding-plan.json");
    if (filename !== allowed)
        throw Error("Use this checkout's isolated .local/bsv/fast/funding-plan.json");
    const plan = JSON.parse(fs.readFileSync(filename, "utf8")), source = read<any>("fast/fee-sponsor-public");
    if (!source || source.lockingScript !== script || source.returnLockingScript !== script)
        throw Error("This standard wallet does not own the configured sponsor source");
    const hash = planHash(plan.partialRaw), previous = ledger.signatures.find((x: any) => x.planHash === hash);
    if (previous) {
        write("fast/funding-signed", previous);
        console.log(JSON.stringify({ txid: previous.txid, reused: true }));
        return;
    }
    const budget = read<any>("fast/run-budget");
    if (ledger.signatures.length >= 2 || !budget || !Number.isFinite(Date.parse(budget.deadline)) || Date.now() >= Date.parse(budget.deadline))
        throw Error("New native funding budget closed; existing exact hashes remain reconcilable");
    if (ledger.signatures.length === 0 && source.satoshis !== 6000)
        throw Error("First sponsor source must be6000sat");
    if (ledger.signatures.length === 1 && (source.satoshis !== 4000 || source.txid !== ledger.signatures[0].txid || source.vout !== 2 || !isAcceptedProof(ledger.firstPayout) || !isAcceptedProof(source.afterAcceptedPayout) || source.afterAcceptedPayout?.txid !== ledger.firstPayout.txid))
        throw Error("Second pool requires the verified first payout and exact sponsor change");
    const { tx, guard } = validateFastSponsorPlan(plan, source), { hash: signatureDigest, scope } = signatureHash(tx, 2), sig = await w.createSignature({ hashToDirectlySign: signatureDigest, protocolID: PROTOCOL, keyID: KEY, counterparty: "anyone" });
    tx.inputs[2].unlockingScript = new BSV.UnlockingScript().writeBin(txSignature(Array.from(sig.signature), scope)).writeBin(BSV.Utils.toArray(pub, "hex"));
    validInputs(tx, [0, 1, 2]);
    const signed = { network: "testnet", id: plan.policy.id, planHash: hash, txid: tx.id("hex"), raw: tx.toHex(), beef: Array.from(tx.toAtomicBEEF()), feeSatoshis: 2000, policy: plan.policy, policyHash: guard.info.lockingScriptSha256, signedAt: new Date().toISOString() };
    ledger.signatures.push(signed);
    write("fast/sponsor-allocations", ledger);
    write("fast/funding-signed", signed);
    console.log(JSON.stringify({ txid: signed.txid, status: "Fixed funding co-signed; not broadcast", feeSatoshis: 2000 }));
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href)
    main().catch(e => { console.error(e.message); process.exitCode = 1; });
