# Fact Market — API3 presentation and submission draft

## Presentation decision — 31 October 2026, 12:51:55 Europe/Berlin

**Present http://localhost:3102/next, the verified API3/Base Sepolia V2.** Its recorded live lifecycles and public chain audit pass. Keep `/` as the preserved original baseline. Native `/bsv/fast` is experimental: the 45-minute new-funding budget closed after exactly two authorized pools, and native readiness remains false for this run. No third pool will be created.

The native Script has now executed a real 2,000 sat outcome payout, with full-node UTXO validation but no recorded block confirmation. However, validated prefunding before the historical observation windows was not proven, and the separate refund is still waiting for chain median time. A later refund cannot repair the missing historical prefunding evidence. Do not combine these records into a completed native product or BSV qualification claim. Details and exact receipts are in [BSV_HANDOFF.md](BSV_HANDOFF.md) and [the native runbook](docs/BSV_FAST_RUNBOOK.md).

## 150-second API3 presentation outline

- **0:00–0:15 — Problem.** A platform should not be able to change the data channel or settlement rule after a user funds a position. Fact Market fixes both, together with the beneficiary and payment limits.
- **0:15–0:35 — Real agent proposal.** Open `/next`, use the ETH/USD goal and show the recorded local model call, allowed recipe and independently derived threshold. The model proposes a bounded position; it cannot select arbitrary tools, signers, destinations or the winning result.
- **0:35–0:55 — Initial delegation and funding.** Show the immutable recipe/policy hashes, observation window, strict comparator, fixed beneficiary and one-position FMCT cap. Open the actual buyer and opposing-role funding receipts. These are isolated local test roles, not independent customers.
- **0:55–1:20 — Signed evidence and payout.** Open the completed ETH/USD market. Show original response bytes, source time separately from signature time, the accepted outcome, real Base Sepolia settlement/claim receipts and zero remaining reserve. The agent initiates the economic action after the initial mandate; Nodary itself is free.
- **1:20–1:55 — Valid plus four rejected responses.** Show the existing actual on-chain tamper receipts and historical replay: edited value, authentic stale response, authentic different request and wrong signer. Explain the decoded expected error and unchanged protected reserve. Do not rerun them against an already-settled market and call its unrelated closed-state rejection a signature test.
- **1:55–2:15 — Immutable rules and retry safety.** Show duplicate-intent rejection, wrong-feed protection, and the recipe/beneficiary that cannot be edited after funding. Explain the no-valid-data refund rule without borrowing the unfinished native refund as EVM evidence. First accepted eligible window observation sets the result; it is not an exact-second quote.
- **2:15–2:30 — Verify.** Show the public repository, actual deployed contract/network, explorer links and judge response-submission route. State the source-authenticity/upstream-truth boundary. End on the working API3 flow.

This remains an outline. Actual video recording/upload and competition submission have not been performed. The video must be at most 150 seconds.

## Main Devfolio description draft — API3

**Fact Market: agent-funded positions under a fixed signed-source rule.**

Market creators and agent developers need a way to turn an external-data question into a collateralized position without letting the platform choose a different evidence channel after users fund it. Fact Market uses a real local language model to propose a bounded ETH/USD rule. V2 also supports the existing BTC/USD recipe; a separate validator checks the requested asset and derives the threshold. Source operation, exact request/projection, signer, timing, stake limits and payout recipients are pinned before exposure.

After one capped initial mandate, the executor funds matched test positions, submits an eligible original AirnodeHub response to the deployed Base Sepolia contract, and triggers the fixed beneficiary's claim. The contract checks the expected signer, intended request, envelope and source timestamps, immutable observation window and duplicate-action protection. Real recorded lifecycles include both feeds, payouts and rejected tamper/wrong-feed responses. Anyone can inspect the public receipts or submit an original response through the documented UI/script.

AirnodeHub supplies the essential verifiable input: a forged or wrong-request value could otherwise select the wrong beneficiary. Neither the model's explanation nor a database flag can settle the market. The model never receives keys or arbitrary transaction authority. On-chain mandate limits and a small isolated local test-wallet executor bound payments; gas/tool budgets are application controls, and this is not a session-key platform. Nodary calls are free; the real economic action is FMCT position funding and contract-enforced payout, not a fabricated x 402 data fee.

These valueless test roles are controlled by the installation and do not establish external customer demand. Signatures authenticate the original source and bytes, not upstream truth, profitable prediction or continuous price behavior. Settlement uses the first accepted eligible window observation rather than a guaranteed exact historical second. No platform administrator can alter the stored rule or withdraw the protected reserves. The code is not an independently audited production financial product.

All completed main-product value actions use valueless Base Sepolia test assets. The separate native BSV investigation is an experimental engineering extension with explicit gaps, not a completed dual-track qualification claim. No hosted deployment, mainnet spending, video upload or Devfolio submission was performed by this delivery.

## Optional native engineering appendix — latest node snapshot 12:51:55 Berlin

The new BSV Script computes Keccak/EIP-191 over original Airnode bytes and verifies the original secp256k1 signature itself; there is no relayer re-signature or EVM approval in that native contract. The immutable rule protects the full 2,000 sat pool and fixed 1,000/1,000 refund shares, with fees from an external input. A real outcome has current UTXO spend/create validation, proving more than a local VM replay. Block confirmation and economic prefunding chronology remain separate facts.

| Native record | Current evidence |
|---|---|
| [First funding](https://test.whatsonchain.com/tx/42926a8684b7bd7d1e1643ac273266a043859cb19c0af1b36bf5653806ac8de9) | MINED in block 1766139 |
| [First 2,000 sat payout](https://test.whatsonchain.com/tx/486b0e718f95538e8e2881ee36ea310e8c61b3aa9fb65feb567580ee25f8603e) | Full-node UTXO-validated, UNCONFIRMED |
| [Second funding](https://test.whatsonchain.com/tx/00e13304fc82ed7f22f1db062afc89eb9aaf2fe22c9f39d979153a2256aa3099) | MINED in block 1766140 |
| Saved refund `114518d7f422662132ed9014512035b985d2320cfa378cf55701786e07e7e3ab` | Waiting for chain median time >11:24:10 UTC; not a completed refund |

Strong validation was observed at 11:29:52 UTC, after both source windows. Earlier HTTP 200/raw/public observations established transport and commitment, not validated prefunding. Teranode can acknowledge asynchronous Kafka submission before validation, and a raw-store GET does not prove script execution. No earlier validated UTXO observation was recorded; this is an unknown historical validation time, not proof that the transactions were invalid beforehand. Current code distinguishes transport/validation/mining, gates on canonical UTXO state and chooses saved refund when new funding validation is observed late.

Native local checks in `fast-live-tamper.json` pass 7 actual-policy cases: valid response, four oracle failures, redirected recipient and reduced principal. `fast-check-replay.json` is separate historical read-only replay; neither report is a set of mined rejected transactions. Source/SDK/node tests passed 48/48. First observed validation is in `fast-node-utxo-validation.json`; latest mining/UTXO status is in `fast-node-utxo-validation-final.json` and must not be substituted with local fixture success.

The second refund was signed before publication. Its initial mandate expires 11:37:10 UTC, but the existing signed refund can continue to reconcile without renewed authority. No new pool or top-up is authorized. The old 5 MB `/bsv/native` pool remains resource-blocked, with no extra recovery attempt added. Its history and the custodial relay experiment are not merged into this native result.

## Submission evidence and remaining work

- Main version: `/next`, public audit `docs/evidence/v2/verification-public.json` PASS; real chain lifecycles in `docs/evidence/v2/chain-smoke.json`. Reproduce with `npx tsx scripts/next-verify.ts --public`, without private roles or new payment.
- Public repository/setup: [ABerkeBora/heka-fact-market](https://github.com/ABerkeBora/heka-fact-market), [README](README.md). Verify the final source commit's publication separately from an earlier public commit.
- API3 judge route: Evidence submission UI and documented permissionless contract ABI/script. Native `/bsv/fast` checker is a separate read-only VM check, with the selected historical market context labelled explicitly.
- Native recovery: saved refund waiting; historical prefunding proof missing; `nativeReady=false` for this run. Do not claim all native qualification items PASS or call UNCONFIRMED receipts mined.
- Video<=2.5 minutes: **PENDING** recording/upload. Devfolio entry: description draft only, **PENDING** team action.
- General deadline last checked: **31 October 2026, 15:00 Europe/Berlin**, one team entry and up to three partner tracks. The final official rule check is recorded in the track checklist.

Historical paid PandaScore discovery remains in the README and `docs/evidence/pandascore-paid-discovery.json` (0.02 test aUSD total). It is outside this focused presentation, does not establish a completed PandaScore market and is not substituted for the free Nodary flow.
