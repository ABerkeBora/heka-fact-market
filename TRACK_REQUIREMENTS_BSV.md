# Fact Market BSV — requirements and actual evidence

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

V1/V2 retain their separate, completed API3/EVM evidence in `TRACK_REQUIREMENTS.md`, `MORNING_HANDOFF_V2.md` and `docs/evidence/v2/`. Their qualification is not automatically transferred to this BSV-native experiment. Relay EVM approval [9c06840…](https://sepolia.basescan.org/tx/0x9c06840d3bc104a579adfe4068c7490c1e5a415a80b0f2732371fc736b666a6b) is original-envelope EVM verification followed by a trusted attestor, not native BSV verification.

Freshness is the immutable observation window/source-signature relation, not a BSV current-clock quote. An eligible historical window proof can compete with matured refund until one valid spend wins. API signatures authenticate origin/bytes, not upstream factual truth. Funding bytes were signed/journaled before the window; independent network visibility was only observed after the window, so this pilot does not prove public prefunding before the result became knowable.

## Mandatory submission and optional judging guidance

| Submission item | Evidence / remaining action | Status |
|---|---|---|
| Public source + setup README | Authorized repo `ABerkeBora/heka-fact-market`, `codex/bsv`; `README.md`, `docs/BSV_SETUP.md`, lockfile, public native source/artifact/provenance | PENDING final push |
| At most150second video | Outline in `BSV_HANDOFF.md`; no recording made | PENDING |
| Detailed Devfolio description | Draft in `BSV_HANDOFF.md`; no entry submitted | PENDING |
| BSV example transactions and end-to-end agent payment | Linked real funding/relay transactions; native outcome/recovery incomplete | PENDING complete native flow/video |
| API3 address/network, own-response path, valid+four-reject video | Existing API3 V1/V2 evidence retained; native live action blocked | BLOCKED native / PENDING video |
| Deadline and track count | Rechecked31 October2026 **15:00 Europe/Berlin**; one submission/team, up to3 partner tracks | PASS rule check |

Useful DeFi/adoption, technical quality, originality, non-custodial execution and clear demonstration are judging guidance after qualification. Example swaps, launchpads and bridges are optional, not extra requirements. A paid API call or control dashboard alone does not establish the DeFi core. The user's requested agentic-payment focus is a product constraint, not an invented official requirement that every action use an LLM.
