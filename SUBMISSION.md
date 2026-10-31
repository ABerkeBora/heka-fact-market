# VeriFi Market — submission draft (API3 + BSV)

## Tracks and status — 31 October 2026

One Devfolio entry, two partner tracks: **API3 — Any API in your contract** and **BSV — DeFi Rails for Agentic Payments**. The same rule runs on both chains: a market's payout is decided only by an authenticated AirnodeHub response, verified on chain.

**Agent payments:** the executor paid two x402 data calls (PandaScore, 0.02 test aUSD in total), funded the agent's positions (FMCT on Base Sepolia, 1,000 sat stakes on BSV), and the verified data then released the payouts. Transaction links: README "Agent payments".

- **API3 (Base Sepolia V2, `/next`):** complete. Real settlements and payouts for ETH/USD and BTC/USD, four tamper rejections on the same open market before its valid settlement, and a read-only judge replay (`scripts/judge-next.ts`).
- **BSV (`/bsv/fast`):** the locking Script verifies the original Nodary EIP-191 signature itself — no relayer, no EVM approval. Funding comes from BSV Desktop through the BSV SDK / Wallet Toolbox; payout is enforced by the Script to fixed recipients. Real testnet funding and a 2,000 sat payout are on WhatsOnChain. Open points are listed honestly in the README "Known limitations": funding validation was first observed after the window opened, the BSV tamper cases are local-VM runs, and the second pool's timed refund became spendable about an hour after its nominal unlock because of median-time lag (it was broadcast at 12:28 UTC: [refund](https://test.whatsonchain.com/tx/114518d7f422662132ed9014512035b985d2320cfa378cf55701786e07e7e3ab), 1,000 + 1,000 sat back, fee from a separate input).

Details and exact receipts: [the native runbook](docs/BSV_FAST_RUNBOOK.md) and [docs/history/BSV_HANDOFF.md](docs/history/BSV_HANDOFF.md).

## BSV track items (official "Extra items per track")

**Example transactions on WhatsOnChain.** [First pool funding](https://test.whatsonchain.com/tx/42926a8684b7bd7d1e1643ac273266a043859cb19c0af1b36bf5653806ac8de9) (mined, block 1766139) · [2,000 sat outcome payout](https://test.whatsonchain.com/tx/486b0e718f95538e8e2881ee36ea310e8c61b3aa9fb65feb567580ee25f8603e) (node-validated) · [second pool funding](https://test.whatsonchain.com/tx/00e13304fc82ed7f22f1db062afc89eb9aaf2fe22c9f39d979153a2256aa3099) (mined, block 1766140) · [timed refund of the second pool](https://test.whatsonchain.com/tx/114518d7f422662132ed9014512035b985d2320cfa378cf55701786e07e7e3ab) (1,000 sat to each side, broadcast 12:28 UTC, not yet mined at the last check).

**Problem.** When an agent puts money behind an outcome, whoever settles the outcome can redirect the money. On most platforms that is the operator's database.

**Target users.** Agent developers and market creators who want an agent to take a bounded, fully collateralized position on a data question, and counterparties who want to know the result cannot be chosen by the platform.

**How people use it.** Ask a question in plain language. The agent picks a vetted data source, side and threshold; the rule is locked into a BSV Script before funding; the user funds from BSV Desktop; the Script pays the winner only when presented with the provider's original signed response, or refunds both sides after the deadline.

**What it brings to BSV.** A pay-on-verified-data rail for agents: an agent locks BSV in a Script that releases it only when an authenticated AirnodeHub response confirms the outcome — no bridge, no relayer, no operator decision. The prediction question is the first template; the same pattern can condition agent payments on flight status, deliveries or weather (not implemented yet). Every conditional payment is BSV liquidity and on-chain activity, and BSV's low fees make small stakes (we used 1,000 sat) practical. Built on the official TypeScript stack: BSV SDK, Wallet Toolbox and BSV Desktop.

## 150-second video (API3 + BSV)

Recorded receipts from 31 October are shown as recorded; label any time cut on screen.

- **0:00–0:12 — Problem.** Whoever settles an outcome can redirect the money. VeriFi Market locks the rule before funding and lets only an API3-signed response decide.
- **0:12–0:35 — Agent.** At `/next`, type a goal. The local model reads a real signed price and proposes feed, side and threshold; independent code checks it. The resolution card shows source, request, signer, threshold and window fixed before funding.
- **0:35–0:55 — Payment and payout (Base Sepolia).** Open the completed ETH/USD market: agent and counterparty funding, original signed bytes, settlement, 2 FMCT payout on Basescan.
- **0:55–1:25 — Tamper test, pass/fail.** In a terminal: `npx tsx scripts/judge-next.ts --case valid` → ACCEPTED, then `edited-value`, `stale-real-response`, `different-request`, `wrong-signer` → REJECTED with the contract's error. Then Basescan: the same four reverted transactions on the open market, before its settlement block.
- **1:25–2:05 — BSV.** At `/bsv/fast`: the BSV Script itself verifies the same Nodary signature, with no relayer. Show the recorded agent proposal and BSV Desktop funding, then WhatsOnChain: pool 1 funding → 2,000 sat payout; pool 2 funding → timed 1,000/1,000 refund. The BSV tamper checker runs locally against the real policy; say so.
- **2:05–2:30 — Close.** Signatures authenticate the provider, not the truth; providers come from a curated list. Repo, contract address and WhatsOnChain links on screen.

## Main Devfolio description draft

**VeriFi Market: agent-funded positions under a fixed signed-source rule.**

Market creators and agent developers need a way to turn an external-data question into a collateralized position without letting the platform choose a different evidence channel after users fund it. VeriFi Market uses a real local language model to propose a bounded ETH/USD rule. V2 also supports the existing BTC/USD recipe; a separate validator checks the requested asset and derives the threshold. Source operation, exact request/projection, signer, timing, stake limits and payout recipients are pinned before exposure.

After one capped initial mandate, the executor funds matched test positions, submits an eligible original AirnodeHub response to the deployed Base Sepolia contract, and triggers the fixed beneficiary's claim. The contract checks the expected signer, intended request, envelope and source timestamps, immutable observation window and duplicate-action protection. Real recorded lifecycles include both feeds, payouts and rejected tamper/wrong-feed responses. Anyone can inspect the public receipts or submit an original response through the documented UI/script.

AirnodeHub supplies the essential verifiable input: a forged or wrong-request value could otherwise select the wrong beneficiary. Neither the model's explanation nor a database flag can settle the market. The model never receives keys or arbitrary transaction authority. On-chain mandate limits and a small isolated local test-wallet executor bound payments; gas/tool budgets are application controls, and this is not a session-key platform. Nodary calls are free; the real economic action is FMCT position funding and contract-enforced payout, not a fabricated x 402 data fee.

These valueless test roles are controlled by the installation and do not establish external customer demand. Signatures authenticate the original source and bytes, not upstream truth, profitable prediction or continuous price behavior. Settlement uses the first accepted eligible window observation rather than a guaranteed exact historical second. No platform administrator can alter the stored rule or withdraw the protected reserves. The code is not an independently audited production financial product.

All completed main-product value actions use valueless Base Sepolia test assets. The separate native BSV investigation is an experimental engineering extension with explicit gaps, not a completed dual-track qualification claim. No hosted deployment, mainnet spending, video upload or Devfolio submission was performed by this delivery.

## API3 track items (official "For this track" list, rechecked 31 Oct 2026, 13:12 Berlin)

**Deployed contract and network.** FactMarketNext `0x9319e85d84beb94307e91c350209e5e429b8be34`, Base Sepolia (chain 84532). Test collateral FMCT `0xd6e4968b75422dfb13759138808a4310cec061b3`.

**Judge response route.** Read-only replay with your own edited or re-signed envelope: `npx tsx scripts/judge-next.ts --case valid --save valid.json`, edit, then `--file valid.json` (no wallet, no gas). Live route on a fresh market: the `/next` Evidence form or `POST /api/next/markets/:id/submit`, or a direct `settle` call with the public ABI. Details and limits: README, "Judge tamper test — V2".

**Who relies on the data.** The two position holders in each market: the agent's user, who funds one side under a capped mandate, and the opposite side. In this build both are test roles controlled by this installation. The data is their only settlement input; the contract pays the full pool to whichever side the signed ETH/USD or BTC/USD value selects. A market operator also relies on it, because it can then show participants that it did not choose the result.

**What goes wrong if it is forged.** The full collateral goes to the wrong side. An edited price, a real but old price, a real price for a different asset or request, or a value signed by another key could each flip the YES/NO result. A settled market cannot be re-settled, so the error would be permanent. The contract rejects all four before any state change; the recorded receipts are listed in the README. The signature proves the response came from Nodary for this exact request; it does not prove that Nodary's upstream price is correct.

**What data we wanted but could not find.** We did not hit a missing-data blocker for this MVP: the ETH/USD and BTC/USD feeds we needed were available. The data we most wanted next is a signed point-in-time price, so settlement does not depend on which in-window observation is submitted first. Nodary, which we integrated, exposes only `latestFeeds`; the AirnodeHub catalogue does list CoinPaprika daily history and Blocksize 30-minute closes, which we have not integrated yet. We also tested paid PandaScore discovery and match metadata (0.02 test aUSD); that data was available, but we did not build a sports market from it.

## Native engineering appendix — latest node snapshot 12:51:55 Berlin

The new BSV Script computes Keccak/EIP-191 over original Airnode bytes and verifies the original secp256k1 signature itself; there is no relayer re-signature or EVM approval in that native contract. The immutable rule protects the full 2,000 sat pool and fixed 1,000/1,000 refund shares, with fees from an external input. A real outcome has current UTXO spend/create validation, proving more than a local VM replay. Block confirmation and economic prefunding chronology remain separate facts.

| Native record | Current evidence |
|---|---|
| [First funding](https://test.whatsonchain.com/tx/42926a8684b7bd7d1e1643ac273266a043859cb19c0af1b36bf5653806ac8de9) | MINED in block 1766139 |
| [First 2,000 sat payout](https://test.whatsonchain.com/tx/486b0e718f95538e8e2881ee36ea310e8c61b3aa9fb65feb567580ee25f8603e) | Full-node UTXO-validated, UNCONFIRMED |
| [Second funding](https://test.whatsonchain.com/tx/00e13304fc82ed7f22f1db062afc89eb9aaf2fe22c9f39d979153a2256aa3099) | MINED in block 1766140 |
| [Timed refund](https://test.whatsonchain.com/tx/114518d7f422662132ed9014512035b985d2320cfa378cf55701786e07e7e3ab) | Broadcast 12:28 UTC after chain median time passed 11:24:10 UTC; node-accepted, 1,000/1,000 sat principal, fee from a separate input; not yet mined at the last check |

Strong validation was observed at 11:29:52 UTC, after both source windows. Earlier HTTP 200/raw/public observations established transport and commitment, not validated prefunding. Teranode can acknowledge asynchronous Kafka submission before validation, and a raw-store GET does not prove script execution. No earlier validated UTXO observation was recorded; this is an unknown historical validation time, not proof that the transactions were invalid beforehand. Current code distinguishes transport/validation/mining, gates on canonical UTXO state and chooses saved refund when new funding validation is observed late.

Native local checks in `fast-live-tamper.json` pass 7 actual-policy cases: valid response, four oracle failures, redirected recipient and reduced principal. `fast-check-replay.json` is separate historical read-only replay; neither report is a set of mined rejected transactions. Source/SDK/node tests passed 48/48. First observed validation is in `fast-node-utxo-validation.json`; latest mining/UTXO status is in `fast-node-utxo-validation-final.json` and must not be substituted with local fixture success.

The second refund was signed before publication. Its initial mandate expires 11:37:10 UTC, but the existing signed refund can continue to reconcile without renewed authority. No new pool or top-up is authorized. The old 5 MB `/bsv/native` pool remains resource-blocked, with no extra recovery attempt added. Its history and the custodial relay experiment are not merged into this native result.

## Submission evidence and remaining work

- Main version: `/next`, public audit `docs/evidence/v2/verification-public.json` PASS; real chain lifecycles in `docs/evidence/v2/chain-smoke.json`. Reproduce with `npx tsx scripts/next-verify.ts --public`, without private roles or new payment.
- Public repository/setup: [ABerkeBora/heka-fact-market](https://github.com/ABerkeBora/heka-fact-market), [README](README.md). Verify the final source commit's publication separately from an earlier public commit.
- API3 judge route: read-only `scripts/judge-next.ts` replay against the deployed V2 contract (own envelopes, no wallet), the `/next` Evidence UI / `POST /api/next/markets/:id/submit` on a fresh market, and the permissionless `settle` ABI. `npm run judge:submit` is V1 only. Native `/bsv/fast` checker is a separate read-only VM check, with the selected historical market context labelled explicitly.
- Native recovery: saved refund waiting; historical prefunding proof missing; `nativeReady=false` for this run. Do not claim all native qualification items PASS or call UNCONFIRMED receipts mined.
- Video<=2.5 minutes: **PENDING** recording/upload. Devfolio entry: description draft only, **PENDING** team action.
- General deadline last checked: **31 October 2026, 15:00 Europe/Berlin**, one team entry and up to three partner tracks. The final official rule check is recorded in the track checklist.

Historical paid PandaScore discovery remains in the README and `docs/evidence/pandascore-paid-discovery.json` (0.02 test aUSD total). It is outside this focused presentation, does not establish a completed PandaScore market and is not substituted for the free Nodary flow.
