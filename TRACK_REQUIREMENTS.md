# Fact Market track requirements

Selected track: **API3 — Any API in your contract**. BSV conditional technical gate did not establish a native verifier or standard-wallet transaction and is excluded. Cardano is outside scope.

Start check: **2026-10-31 approximately03:39 Europe/Berlin**, before application/contract code. Correct API3 tab selected in real browser; qualification/submission/judging/examples and About expanded; general submission separately read. Official starter and guides read.

Finish check: **2026-10-31 03:55 Europe/Berlin**. Page reloaded; correct API3 tab reselected and About/submission/judging expanded; general submission/deadline reread. No material rule changes observed. Screenshots `docs/evidence/rules-finish-api3.jpg` and `rules-finish-general.jpg`.

## Official sources

- https://hackathon.tum-blockchain.com/prizes#api3
- https://hackathon.tum-blockchain.com/prizes#how-to-submit
- https://github.com/api3dao/airnodehub-hackathon-starter/tree/52933ae1fb9371446a927338473466c3d320e19a
- https://api3dao.github.io/airnodehub-hackathon/docs/from-api-to-contract
- https://api3dao.github.io/airnodehub-hackathon/docs/integrations
- https://api3dao.github.io/airnodehub-hackathon/docs/projections

## Mandatory technical qualification

| Requirement | Implementation | Status and actual evidence |
|---|---|---|
| AirnodeHub essential to core workflow | Payout side cannot be selected without Nodary attestation | **PASS** contracts/FactMarket.sol settle; live market1+2 agent-runs.json |
| Signed response to deployed contract checks expected signer, intended request and timing | Immutable ETH/USD request+signer; official attestation helper; both source/envelope ages and fixed window | **PASS** deployment.json and chain-smoke.json; Base Sepolia factory0xfbacf475b8a6729d97db83a06b07ff303a243614 |
| Exact signed value drives meaningful state change; duplicate protection | Binary result selects2FMCT winner claim; unique intents, single settlement/claim | **PASS** chain-smoke.json validAction+payout+finalMarket.reserve0;29Soliditytests |
| Valid timely real response triggers action | Actual Nodary value selects YES; agent triggers payout | **PASS** settlement0x24dd82d6f81410ed9f6a93e0d25fce968756434ebe940b70e23199672ec3d04f; claim0x8b67fa836569bcb0f3ddd50e5679b9b8090b036485e8bb3b77fae09afd1793c5 |
| Edited real value rejected | Contract NotSignedByAirnode before state change | **PASS** chain-smoke.json edited-value; reverted0x2baffeffef08ff45528a75ae5af43120c1968423624c1e5367af1cef2c5e009e |
| Authentic too-old response rejected | ResponseTooOld; unmodified earlier signed observation | **PASS** reverted0x859afce5089b59abc90698839c480b56f2245a14dd614be7480d2c1a6e158827 |
| Different real request rejected | Fresh BTC/USD response against fixed ETH/USD policy | **PASS** NotSignedByAirnode; reverted0xf51d518767d914f80cd4f8f3c9f1fd49bb1e65c9832d41e710cf47030183e052 |
| Wrong-key response rejected | Real payload re-signed with another test role | **PASS** NotSignedByAirnode; reverted0x39ec44ddac564def8437155c470135301f42d5e104cf0cf15c9a5d10f39dca15 |

All four oracle cases occurred on the same matched open market before its valid settlement. `scripts/verify-tamper.ts` independently checks each expected custom error at its historical receipt block, the observation window, unchanged state and reserve. Fixtures/local clock warp are used for broader unit tests only and are not substituted for these live cases.

## Mandatory track submission

| Item | Deliverable/evidence | Status |
|---|---|---|
| Contract address and network | docs/evidence/deployment.json; docs/FactMarket.abi.json; README | **PASS** |
| Judges submit their own responses | Evidence UI and npm run judge:submit; direct permissionless contract ABI; on-chain authority | **PASS** implemented; browser rejects malformed envelope recoverably. Use a fresh funded market for oracle tamper rather than an already settled market. |
| Video includes valid action and four tamper failures |150-second outline SUBMISSION.md; actual live evidence prepared | **PENDING** actual recording/upload,10–20min team action |
| Description explains users, forged-data harm and unavailable data | SUBMISSION.md Devfolio draft | **PENDING** content ready; team has not entered/submitted it on Devfolio |

## General submission

| Item | Deliverable | Status |
|---|---|---|
| Public repo and setup/run README | https://github.com/ABerkeBora/heka-fact-market ; pinned npm lockfile and standalone sources | **PENDING** repo created; final source push verification follows |
| Detailed Devfolio project description | Complete draft in SUBMISSION.md | **PENDING** team submission |
| Video at most2.5minutes |150-second outline prepared | **PENDING** actual recording |
| Current deadline/rules verified |31October2026 15:00Europe/Berlin; one entry per team, up to3partner tracks | **PASS** rule reading only, finish screenshot |

Overall competition submission is **not complete** while these PENDING team actions remain. This is a reviewable technical build, not a claim that all official submission requirements have been satisfied.

## User product acceptance (separate from sponsor rules)

| Item | Evidence/status |
|---|---|
| Real runtime LLM from real source; bounded independent validation | **PASS** two actual qwen3:4b structured calls in agent-runs.json; strict schema and deterministic threshold/time derivation |
| Initial mandate → autonomous economic action | **PASS** two market position funding/settlement/claim cycles; second launched through real browser UI |
| Separate counterparty, fixed payer/beneficiary/recipient/asset/network | **PASS** isolated buyer/counterparty test roles, equal1FMCT stakes, immutable factory/token; public role addresses in evidence |
| Per-action/total/action/expiry caps and duplicate rejection | **PASS** on-chain mandate tests; actual buyer duplicate0xf0889237cb829c51ff1a61db00b2c188a174482c11fd8c4066219369a9e39017; duplicate-authorize.json |
| Durable intents, uncertain-broadcast reconciliation, no automatic top-up | **PASS** journal-before-broadcast transaction hash/raw; role queues and process lock;8 executor/model tests; completed paid-provider script reused receipts on rerun |
| Meaningful refunds/reserve protection | **PASS**29contracttests including matched/unmatched void, double claim, transfer rollback and256fuzz reserve cases. Live completed markets paid out; no live void transaction claimed. |
| Actual paid provider call when priced | **PASS** two PandaScore x402 calls total0.02testaUSD, exact transfer logs/signatures; discovery only |
| Build/browser/three widths/secrets | **PASS** productionbuild;8TS+29Soliditytests; BROWSER_QA.md and ui screenshots; privateURL404 and publish-tree scan |

Limits: caps are per mandate ID, not an account-wide session-key system. Gas/tool budgets are app-enforced; L1 protocol pricing receives a conservative reservation, not a hard on-chain ceiling. API fee, collateral and gas remain separate. No model settlement authority, mainnet funds, hosted deployment or competition submission.

## Source semantics and optional judging preferences

Nodary's implemented policy is the first accepted source observation within a fixed short window after trading closes, not historical exact-T or a continuous-threshold claim. Both source and signing timestamps are checked. Missing acceptable evidence means void/refund. First-observation/keeper ordering and upstream provider truth remain disclosed risks.

PandaScore initial and final observations are separate; only discovery/getMatch paid evidence is implemented. BSV is not claimed. Autonomous cycles, usefulness and originality are judging preferences; sponsor examples do not add mandatory scope. Signature authenticity alone does not establish upstream truth.
