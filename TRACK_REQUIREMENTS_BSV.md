# VeriFi Market BSV — requirements and actual evidence

## Current mapping — `/bsv/fast`, submitted flow (rules reread 31 Oct 2026, 13:25 Berlin)

The tables further down describe earlier BSV artifacts (`/bsv/native`, `/bsv` relay) and are kept as history. The submitted BSV flow is the optimized Script at `/bsv/fast`.

| BSV requirement | Evidence | Status |
|---|---|---|
| BSV SDK and Wallet Toolbox (ts-stack) | `package.json` pins `@bsv/sdk` 3.2.1 and `@bsv/wallet-toolbox` 2.14.9; `server/bsv/wallets.ts`, `server/bsv/fast.ts` | PASS |
| Standard BSV wallet in user flows | BSV Desktop (Testnet) through WalletClient prepares the buyer stake from wallet-derived inputs; keys stay in the wallet | PASS |
| Real transactions | Pool 1: [funding](https://test.whatsonchain.com/tx/42926a8684b7bd7d1e1643ac273266a043859cb19c0af1b36bf5653806ac8de9) (block 1766139) → [2,000 sat payout](https://test.whatsonchain.com/tx/486b0e718f95538e8e2881ee36ea310e8c61b3aa9fb65feb567580ee25f8603e). Pool 2: [funding](https://test.whatsonchain.com/tx/00e13304fc82ed7f22f1db062afc89eb9aaf2fe22c9f39d979153a2256aa3099) (block 1766140) → [timed refund 1,000/1,000](https://test.whatsonchain.com/tx/114518d7f422662132ed9014512035b985d2320cfa378cf55701786e07e7e3ab) | PASS |
| Non-custodial funds | The locking Script pays only fixed recipients: the winner (with the original Nodary signature, verified in Script) or both sides after the refund time. No relayer or platform withdrawal key. The counterparty is a local test role — a market party, not a custodian | PASS (design and recorded spends) |
| AI agent makes a payment | Local `qwen3:4b` proposes side and threshold from a real signed price; the executor funds the agent's stake under a capped mandate | PASS |
| DeFi product is the core | Conditional-payment escrow settled by authenticated external data | Judgment for the judges |
| WhatsOnChain example transactions | Links above | PASS |
| Video: end to end incl. agent payment | Plan in SUBMISSION.md | PENDING |
| Description: problem, users, usage, value for BSV | SUBMISSION.md "BSV track items" | PASS content · PENDING Devfolio |

Known gaps (README "Known limitations"): funding validation was first observed after the observation window opened; BSV tamper cases are local-VM runs; refund timing follows chain median time.

Start gate: **31 October2026 10:22 Europe/Berlin**. Finish recheck: **31 October2026 11:04 Europe/Berlin**, actual BSV/API3/general tabs selected, submission/judging/examples expanded. No material change. Sources: [BSV rules](https://hackathon.tum-blockchain.com/prizes#bsv-association), [API3 rules](https://hackathon.tum-blockchain.com/prizes#api3), [general submission](https://hackathon.tum-blockchain.com/prizes#how-to-submit), [official ts-stack](https://github.com/bsv-blockchain/ts-stack), [API3 starter](https://github.com/api3dao/airnodehub-hackathon-starter). Local sponsor pack `START-HERE.md`, `AGENTS.md` and relevant complete stack guide wallet/signing/treasury sections were read before code. Pinned SDK3.2.1/Wallet Toolbox2.14.9.

## Mandatory BSV qualification

| Requirement | Concrete evidence | Status |
|---|---|---|
| Official SDK and Wallet Toolbox | `package.json`; `server/bsv/sdk.ts`, `wallets.ts`; official SDK Script verification | PASS |
| Standard BSV wallet user flow | Desktop WalletClient, testnet hard gate, derived-key1000sat buyer preparation [6852f04…](https://test.whatsonchain.com/tx/6852f04f5a8ce17efcb1aa80837e2e3e2a7f0d2a903e70de4a68c9c04c381269); no default-basket bypass | PASS |
| Real BSV transactions | Two-sided native2000sat contract [248baaa…:0](https://test.whatsonchain.com/tx/248baaa5d5f30724b6dd4e057685208f3ebab0289e20c5399ae930ed29925f58); independent peer/raw/explorer witnesses in `docs/evidence/bsv/native-funding-*.json` | PASS: network-visible, not claimed mined |
| Non-custodial principal | `native/contracts/nodary-outcome.ts`, pinned compiled artifact, exact on-chain locking hash; fixed complete winner/refund outputs, no platform/attestor withdrawal key. Local output-redirection/refund tests in `native/evidence/` | PASS for native control design; public-node redemption BLOCKED |
| An AI agent uses project to make a payment | Actual `qwen3:4b` proposal chose YES/-25bps; deterministic policy/mandate and1000+1000 native funding; native proposal/funded evidence. Initial participant/sponsor delegation is explicit | PASS for real funding payment; complete autonomous resolution BLOCKED |

**Current readiness: BLOCKED.** The real native oracle claim passed the local official SDK Script VM, but US/EU/Gorilla reject it for operation limits and the US standard peer rejects `too-long-validation-time`. A separate fixed refund passed the local VM but its single real submission failed chain median-time maturity; skipped-branch opcount may still block it later. New native preparation/funding of this known-blocked artifact is disabled. Do not present this as a completed native prediction lifecycle or all-requirements-ready product.

The `/bsv` relay history has actual1000+1000 deposits and1900sat payout. Its server owns both attestor and counterparty keys, so **it is not non-custodial qualification evidence**; two keys are not two independent parties.

## API3 core and trust

| Mandatory item | New native path | Status |
|---|---|---|
| Essential AirnodeHub data | Removing original signed Nodary bytes prevents oracle outcome spend; exact request/key/window/price bound in Script | PASS design/local VM |
| Signed response submitted to deployed contract and meaningful on-chain action | Funded native Script exists, but real original-envelope outcome claim is rejected by live nodes; no outcome spend accepted | BLOCKED |
| Expected signer, intended request, relevant timing | Two native Keccak computations + original EIP-191/secp256k1 signature; strict price/source parser and immutable signed/source window/lag | PASS local compiled VM; live positive BLOCKED |
| Duplicate protection | Same contract UTXO can be spent once; frozen canonical intent journals; fixed outputs | PASS design/tests |
| Valid plus edited/stale/wrong-request/wrong-signer tamper cases | `native-oracle-rejections.json`: actual pilot policy/recipients,5/5 official SDK VM; `bsv:check` CLI and read-only UI. These are not failing transactions mined on-chain | PASS reproducible local checks; required live positive BLOCKED |
| Deployed contract/network and judge submission | BSV Testnet contract outpoint248baaa…:0 and locking SHA2560cb313…; app checker/CLI uses actual immutable policy. Live custom-response action is not offered while resource gate is blocked | PENDING native judging acceptance |

V1/V2 retain their separate, completed API3/EVM evidence in `TRACK_REQUIREMENTS.md`, `docs/history/MORNING_HANDOFF_V2.md` and `docs/evidence/v2/`. Their qualification is not automatically transferred to this BSV-native experiment. Relay EVM approval [9c06840…](https://sepolia.basescan.org/tx/0x9c06840d3bc104a579adfe4068c7490c1e5a415a80b0f2732371fc736b666a6b) is original-envelope EVM verification followed by a trusted attestor, not native BSV verification.

Freshness is the immutable observation window/source-signature relation, not a BSV current-clock quote. An eligible historical window proof can compete with matured refund until one valid spend wins. API signatures authenticate origin/bytes, not upstream factual truth. Funding bytes were signed/journaled before the window; independent network visibility was only observed after the window, so this pilot does not prove public prefunding before the result became knowable.

## Mandatory submission and optional judging guidance

| Submission item | Evidence / remaining action | Status |
|---|---|---|
| Public source + setup README | Authorized repo `ABerkeBora/heka-fact-market`, `codex/bsv`; `README.md`, `docs/BSV_SETUP.md`, lockfile, public native source/artifact/provenance | PASS — delivery source on `codex/bsv` |
| At most150second video | Outline in `docs/history/BSV_HANDOFF.md`; no recording made | PENDING |
| Detailed Devfolio description | Draft in `docs/history/BSV_HANDOFF.md`; no entry submitted | PENDING |
| BSV example transactions and end-to-end agent payment | Linked real funding/relay transactions; native outcome/recovery incomplete | PENDING complete native flow/video |
| API3 address/network, own-response path, valid+four-reject video | Existing API3 V1/V2 evidence retained; native live action blocked | BLOCKED native / PENDING video |
| Deadline and track count | Rechecked31 October2026 **15:00 Europe/Berlin**; one submission/team, up to3 partner tracks | PASS rule check |

Useful DeFi/adoption, technical quality, originality, non-custodial execution and clear demonstration are judging guidance after qualification. Example swaps, launchpads and bridges are optional, not extra requirements. A paid API call or control dashboard alone does not establish the DeFi core. The user's requested agentic-payment focus is a product constraint, not an invented official requirement that every action use an LLM.

## Completion run start — 31 October2026,11:49Europe/Berlin

Actual BSV, API3 and general tabs selected in Chrome; submission/judging expanded. No selected-track changes. Deadline15:00Berlin, public repository, video<=150seconds and one team submission remain. User selected VeriFi Market only; optimized native success remains PENDING until genuine payout and refund. Existing API3 V2 is the confirmed fallback. No new native funding after11:33:40UTC.

## Completion-run result — 31 October2026,12:40Europe/Berlin

**Present API3 V2 at `/next`. Native `/bsv/fast` remains experimental.** The45-minute new-funding window closed at11:33:40UTC; exactly two optimized pools were funded, with no third pool or mainnet spend. V1/V2 sources and history remain preserved. This section supersedes transport-only acceptance interpretations in earlier experimental snapshots.

| New optimized requirement | Evidence and current status |
|---|---|
| Original Airnode signature and protected native outputs | PASS compiled SDK and actual node UTXO validation: first output2000sat to the real YES beneficiary, separate100sat fee. `fast-live-tamper.json`, `fast-node-utxo-validation-final.json` |
| Runtime LLM and standard-wallet bounded funding | PASS two actual qwen3:4b calls and1000sat buyer stakes; node-validated funding42926a… and00e133…. No fabricated fee for free Nodary |
| Full validation before observation | UNKNOWN for this run. Public funding commitment/visibility preceded each window, but strong validation was first inspected later. The corrected executor requires observed validation before a future market's window; late validation goes to fixed refund |
| Real native outcome | PASS node-execution evidence for486b0e…; UNCONFIRMED at11:29snapshot. First funding42926a… and second funding00e133… are MINED in the11:51:55UTC final node snapshot. No mining/finality claim from raw availability |
| Separate fixed refund and no new signature after expiry | PENDING live clock. Refund114518… was signed11:15:29UTC before funding; fixed1000/1000 returns, lock11:24:10UTC, mandate expiry11:37:10UTC. Existing signed bytes remain usable after expiry; chain median time controls maturity |
| Invalid data and output changes | PASS seven actual-policy read-only VM checks and historical replay. These are local Script replays, not mined failing transactions |
| Replay/crash/accounting safety | PASS48application tests, native12/12plusSDK tests, early-refund API rejection and unchanged canonical funding replay. Standard wallet spent-source repair and read-only reservation gates verified. Two actual post-expiry refund requests retained identical signed bytes and stayed pending at chain MTP; `fast-expired-authority-recovery.json` |
| Complete native readiness / qualification | PENDING. The UI cannot promote a transport ACK into success or retroactively prove prefunding validation. Current recommendation remains API3 V2 |

Teranode propagation HTTP200 can precede the validator on the Kafka path. Full Script validation precedes atomic UTXO spend/create; the implementation now inspects exact input spender/vin and created output states. `VALIDATED_BY_NODE_UTXO` is separate from `MINED`. WOC unconfirmed visibility alone is not assigned validation semantics. Sources pinned in `fast-node-utxo-validation.json` and `server/bsv/node-proof.ts`.

The old5MB2000sat native pool remains separate and execution-blocked; its one later mature refund P2P attempt was refused for validation time. No old history was reset. Video recording and Devfolio submission remain PENDING; no entry was submitted on the team's behalf.
