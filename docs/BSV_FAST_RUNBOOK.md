# Fact Market native BSV runbook

## Which version to present — 31 October 2026, 12:51:55 Europe/Berlin

**Current status (31 Oct, 13:45 Berlin):** `/bsv/fast` is the submitted BSV flow. Both pilot pools completed: pool 1 funding → 2,000 sat payout, pool 2 funding → timed 1,000/1,000 refund (broadcast 12:28 UTC). New pools need the user's explicit go-ahead; the next pool uses a 25-minute pre-window margin. The text below is the 12:51 snapshot, kept for its detail.

The first [native funding](https://test.whatsonchain.com/tx/42926a8684b7bd7d1e1643ac273266a043859cb19c0af1b36bf5653806ac8de9) is MINED. Its [2,000 sat outcome payout](https://test.whatsonchain.com/tx/486b0e718f95538e8e2881ee36ea310e8c61b3aa9fb65feb567580ee25f8603e) has canonical full-node UTXO validation but remains UNCONFIRMED. The [second funding](https://test.whatsonchain.com/tx/00e13304fc82ed7f22f1db062afc89eb9aaf2fe22c9f39d979153a2256aa3099) is now MINED in block 1766140, observed at 12:51:55 Berlin. The second saved refund, `114518d7f422662132ed9014512035b985d2320cfa378cf55701786e07e7e3ab`, waits for chain median time to pass 11:24:10 UTC. It is not yet a successful refund receipt.

Strong spend/create validation was observed at 11:29:52 UTC, after the source windows. Earlier 10:56/11:15 HTTP 200/raw/public observations establish transaction transport and commitment, not validated prefunding. HTTP 200 can mean asynchronous Kafka submission; data-hub raw retrieval can precede validation. An unconfirmed WhatsOnChain transaction lookup does not document validated mempool membership. Current later UTXO proof is real execution evidence, but cannot prove validation before the historical windows. See `docs/evidence/bsv/fast-node-utxo-validation.json` for first-observed validation and `fast-node-utxo-validation-final.json` for latest mining/UTXO status.

Readiness requires valid native outcome and refund receipts **and** validated funding before each observation window. A later recovery cannot repair this run's missing historical prefunding proof. Current code gates newly accepted funding on canonical UTXO validation and takes the saved refund path if validation was only observed late.

## Local prerequisites

Use Node>=22.18, npm, local Ollama with `qwen3:4b`, and the official BSV Desktop standard wallet on **Testnet**, with free test sats. Value keys remain in the wallet. No mainnet, paid API service or new model subscription is needed. The native path has no EVM verification or collateral dependency; the API3/EVM fallback has separate setup in the main README.

```sh
npm ci
cp .env.example .env
npm run build
npm start
```

The native compiled artifact is vendored in `native/fast/`; no compiler binary or parent workspace is needed to run the application. The package pins SDK 3.2.1 and Wallet Toolbox 2.14.9. For independent local cryptographic reproduction:

```sh
npm --prefix native/fast ci --ignore-scripts
(cd native/fast && node test-fast-asm.cjs && node test-fast-sdk-asm.cjs)
```

These tests use fixture UTXOs and do not broadcast them. Run them from `native/fast` as shown: they read the fixture relative to the working directory and rewrite local fixture result JSON, so use a scratch checkout when preserving the existing reports. Source/artifact provenance is in `native/fast/PROVENANCE.json`. Never copy another installation's `.local` directory, private keys, wallets or signed source journals into a fresh clone.

## Fresh test profile: developer setup, not another pool in this run

The current authorized run is closed. The following standalone setup explains how a new operator can configure their own test profile; it is not an instruction to reset the current budget, replace historical escrows or create a third pool. New operator seed/sign flows have not been live-executed by this delivery.

All commands below run from this repository. The application and mutating CLIs share a process lock: stop the server before using a CLI, then restart it. Do not run two signing executors concurrently.

1. Start the server and connect/unlock BSV Desktop Testnet. If the local opposing test role has no funds, explicitly request its one-time 5,000 sat setup grant through the existing API:

   ```sh
   curl -X POST http://localhost:3102/api/bsv/fund-counterparty \
     -H 'Content-Type: application/json' -d '{}'
   ```

   This is setup for an app-owned opposing test role, not customer revenue or an independent customer. The persisted grant is reused; never delete it to obtain another grant.

2. Stop the server. Prepare a self-owned 6,000 sat fee source in the standard wallet, with a 500 sat setup-fee cap:

   ```sh
   npm run bsv:fast:sponsor -- seed-fast --accept-testnet-seed-6000-fee-cap-500
   ```

   Verify that exact transaction's canonical UTXO validation or mined proof; raw lookup/transport alone is insufficient. The command writes only ignored local journals and the public source metadata under `.local/bsv/fast/`. No wallet key is exported. An uncertain wallet result must be reconciled before any replacement preparation.

3. Restart the server and open `/bsv/fast`. Enter the bounded ETH/USD goal and propose a rule. A real local model chooses YES/NO and a permitted−25/0/+25 bps offset; a separate validator derives the threshold and pins the original source, request, signer, observation window and recipients. Model explanation text is not settlement authority.
4. Review the fixed 1,000 sat buyer stake and initial mandate. **Prepare the fixed stake** uses wallet-derived participant inputs. The opposing role prepares 1,900 sat: 1,000 sat of stake and 900 sat of external fee/change. The resulting three-input funding plan is saved to `.local/bsv/fast/funding-plan.json`.
5. Stop the server and let the configured fee owner independently validate and co-sign the exact plan:

   ```sh
   npm run bsv:fast:sponsor -- sign-fast .local/bsv/fast/funding-plan.json
   ```

   This command signs only its exact owned source and fixed outputs:2,000 sat native pool,900 sat opposing fee/change, and 4,000 sat sponsor return; deployment fee 2,000 sat. It verifies the frozen optimized artifact, original Nodary request/signer, future bounded window, distinct participant beneficiaries and both existing participant signatures. It does not broadcast the funding transaction.
6. Restart the server and use the available **Start native agent** action. Before publication the app saves the exact paired refund. Funding must be UTXO-validated before observations become eligible. A timeout reconciles the same canonical hash. `RECEIVED`, HTTP 200/202 transport and raw-store retrieval are provisional; late validation selects fixed refund rather than outcome execution. Do not create a new source or policy to retry an uncertain transaction.

The sponsor CLI is self-contained source tooling. Its seed/sign flows must be exercised with the operator's own fresh test wallet; the recorded current pilot used a separate coordinator fee owner and does not establish that a new operator's wallet permissions are already granted.

## Outcome, refund and recovery

The protected pool is 2,000 sat, fully paid to the fixed winning recipient. A no-data refund returns 1,000 sat to each original participant. A separately signed input pays at most 100 sat settlement/refund fee; principal is not reduced. Nodary calls cost 0 and are not x 402 purchases.

The source is Nodary `latestFeeds`, `name: ETH/USD`, projection `price:/ETH~1USD/value` and `updatedAt:/ETH~1USD/timestamp`. Original signer: `0xE70f1e8b22a21e4Bb5188918a3033341b281E4c0`. Exact request hash: `0x180eae9387bb66a72380e61ebe0a00d19f8414a716a37ebe1df124b66acfff66`. The contract hashes the original signed UTF-8 bytes, checks EIP-191/ECDSA natively, checks source/signature time and applies `price > threshold`; equality is NO.

The first accepted eligible observation determines the result. It is not an exact-second quote or proof of a continuous price condition. After refund maturity, a valid observation and the refund can compete for the same UTXO; only one spend can succeed. Source authenticity does not prove upstream truth. This custom verifier is experimental and has no independent security audit.

- Keep `.local/bsv/fast/` and the standard wallet intact across restarts. The API's available next action explains whether to wait, reconcile, resolve or resume a refund.
- The current second refund was signed at 11:15:29 UTC; its original mandate expires 11:37:10 UTC. It can continue to reconcile without new signing after that expiry. The saved refund binds the real transaction preimage, a non-final input sequence, exact paired recipients and the immutable lock time. Publication waits for chain **median time**, which can lag the wall clock.
- Agent mandate expiry prevents new signing. Reconciliation of an already signed refund uses the same bytes and does not require renewed spending authority.
- An expired unfunded attempt or completed market can be archived by the normal next-proposal flow. A funded or uncertain attempt cannot be reset away. History is kept under ignored `.local/bsv/fast/history/`.
- New funding is limited to two pools and the 45-minute run budget. The second pool requires the first real outcome payout to be verified. Setup sources and existing claims are never automatically topped up.

For a separate authorized operator's second controlled refund test, reuse of the first funding's 4,000 sat return requires a validated first native outcome payout, not only raw visibility. This delivery has already funded its two pools. The helper's validation gates and current runtime budget must be respected:

```sh
# Stop the server first. Replace the argument with the real first outcome hash.
npm run bsv:fast:sponsor -- reuse-change FIRST_ACCEPTED_PAYOUT_TXID
```

Only while the authorized two-pool budget is still open, create the next bounded rule through the normal UI and co-sign its new funding plan with `sign-fast`. The second sponsor return is 2,000 sat. The no-data recovery scenario must be labelled as intentionally withholding observations for a refund test; it is not proof of an upstream outage. Never submit fabricated data to cause that result.

## Read-only verification and presentation evidence

```sh
# The checker accesses public policy/envelopes; no wallet or value transaction.
npm run bsv:fast:check -- --api http://127.0.0.1:3102
npm test
forge test -vv
npm run build
```

The recorded `fast-live-tamper.json` has 7 actual-policy VM cases PASS, with separate historical replay in `fast-check-replay.json`. The source/SDK/node test run has 48 tests PASS. These facts do not substitute for native network receipts or prove pre-window validation.

The checker exercises a valid original response, edited value, authentic stale response, authentic other request and wrong signer, plus protected-output mutations. Its results are **local compiled Script VM evidence**; do not call them mined failing transactions. A valid check does not pay collateral. Actual funding/payout/refund receipts, their canonical UTXO validation, validated-before-window evidence and mined confirmation are separate facts. The UI also accepts a judge's original signed response and clearly labels its check as read-only.

Earlier `fast-*-funded.json`, completed snapshots and transport/explorer records now include `evidenceCorrection`. Original response metadata and early timestamps remain in their historical/legacy fields; first and latest UTXO validation are attached with their actual inspection times. Do not read a legacy HTTP 200 acceptance label as proof of validation before the source window.

An initial reference response can correctly fail the later settlement window. Use the captured eligible observation for the positive check. Public summaries in `docs/evidence/bsv/` may contain hashes, amounts and authentic public responses; keys, wallet databases, raw signing journals and BEEF stay ignored/private.

## Earlier experiments remain separate

The older `/bsv/native`2,000 sat pool at [248baaa…](https://test.whatsonchain.com/tx/248baaa5d5f30724b6dd4e057685208f3ebab0289e20c5399ae930ed29925f58) uses an immutable 5 MB artifact. Its original outcome claim was rejected by operation/time policy. Once its refund became mature, one bounded resubmission of the same refund again received `too-long-validation-time`; see `docs/evidence/bsv/native-recovery-optimized-run.json`. Recovery remains BLOCKED, not merely waiting for the clock. Do not replace that contract or relabel its history as the optimized pool.

The relay `/bsv` paid 1,900 sat, but the same backend controls its attestor and opposing-role keys. It is not native API3 verification or non-custodial qualification evidence. The fallback `/next` keeps its completed original-envelope EVM lifecycle and separate receipt history.
