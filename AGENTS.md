# Fact Market — repository instructions

## Authorized BSV migration — 31 October 2026

The user authorized an isolated BSV prediction-collateral/payout workflow on `codex/bsv`, at `/bsv` and `/api/bsv`. Preserve both `/` and `/next`, their deployments, baselines, journals and proofs. Read `TRACK_REQUIREMENTS_BSV.md` and `BSV_HANDOFF.md`. Earlier BSV-excluded language below is historical and is superseded only for this bounded workflow. Use pinned official SDK 3.2.1 and Wallet Toolbox 2.14.9, derived BRC-100 wallet keys, runtime LLM and testnet only. No mainnet spend. An output-bound attestor after original-envelope EVM verification is a trusted relayer, not native API3 verification or automatic dual-track eligibility. No unilateral refund guarantee unless actually enforced independently of the attestor. Do not modify the native spike owned by the feasibility agent under `.local/bsv-native-spike`.

### Current BSV resource gate

`/bsv/native` has real network-visible2000test-sat funding, but the original-signature outcome claim is rejected by public-node operation/time policy. Its separate fixed refund is signed and pending chain median time; skipped-branch opcount may still prevent execution. Read `BSV_HANDOFF.md`. Preserve all three canonical funding/claim/refund journals and the originalV1/V2. Never describe a local VM pass as network acceptance. New native preparation/funding of the known-blocked artifact is disabled. An optimized artifact must use a separate template/state and prove live compatibility before new collateral; never overwrite the immutable old contract or count two server-held keys as independent parties.

## Authorized V2 successor

The user explicitly authorized the narrow V2 Goal after V1. Read `BASELINE_V1.md`, `NEXT_GOAL_STATUS.md`, `MORNING_HANDOFF_V2.md` and `REVIEW_SUMMARY.json` as applicable. `v1-baseline` freezes working V1 commit `e8fb85c`; never move the tag or reset/delete its source, receipts, state or pending transactions. V2 branch is `codex/next` in the same public repository.

- Preserve V1 `/` and `/api/*` fixed ETH/USD behavior. V2 `/next` and `/api/next/*` use only verified Nodary ETH/USD(feed0) or BTC/USD(feed1), selected by the real model and checked against the goal independently.
- FactMarketNext derives the exact canonical request hash on chain and pins recipeHash/policyHash before funding. Source/endpoint/method/operation/parameters/projection/signer/unit/decimals/predicate/window/refund semantics cannot be changed after exposure. An authentic other-feed response must fail.
- V2 state, intent, deployment and mode0600 wallets are under ignored `.local/next/`, with namespace `fact-market-next` and all signing addresses disjoint from V1. Factories and collateral tokens are separate. Do not consume V1 jobs in V2; shared executor contexts reject foreign job objects. Never race same-key nonces or bypass the exclusive server/CLI lock.
- A one-time small test gas grant is setup, not customer payment. Nodary is free; the real economic action is capped FMCT position funding and contract-enforced payout. Keep per-mandate/key trust and L1 fee limits accurate.
- V2 requires real model/funding for both feeds, at least one complete live settlement/claim, all four oracle rejection guards and V1 core regression. Current evidence has both V2 lifecycles plus one new V1 regression; original V1 public evidence is preserved. Public historical audit: `npx tsx scripts/next-verify.ts --public`; the full private-journal audit requires the preserved workspace.
- Apply the same official API3 start/finish gates below. No new sponsor, arbitrary API platform, full PandaScore lifecycle, exact-T guarantee, hosting, competition submission or real-value spend is authorized.
- For delivery, keep both direct links, evidence and a short V1/V2 recommendation in `REVIEW_SUMMARY.json` (about180words, actual checkedAtUtc and code commits). Recommend the version with the clearest verified value; do not call a test-role scenario an external customer pilot.


## Authorized scope and ownership

Fact Market is an implementation project, not a handoff-only proposal. The user authorized a locally runnable application, a separate public repository, real test-network integration evidence, routine autonomous implementation decisions and a reviewable delivery. Earlier preparation-only language is superseded.

- Work only in this repository's checkout. Do not modify sibling projects, shared services or unrelated processes.
- Default UI: English. Coordination and handoff: Turkish. Local port: **3102**; bind to loopback.
- Primary track: **API3 — Any API in your contract**. BSV is excluded: its conditional standard-wallet/native-verifier/DeFi gate was not demonstrated. Cardano is outside scope.
- Public repository: `ABerkeBora/heka-fact-market`. Source publication is authorized; inspect the publishable tree for secrets/private data first. Verify the actual repository root before Git operations. Use repository-local author/committer identity mapped to the user's GitHub account; do not change global identity or substitute a bot.
- No hosted deployment, competition submission, third-party messaging, mainnet value spend or new paid service is authorized by this scope.
- Read [README.md](README.md), [HANDOFF.md](HANDOFF.md), [TRACK_REQUIREMENTS.md](TRACK_REQUIREMENTS.md) and [MORNING_HANDOFF.md](MORNING_HANDOFF.md) before changing the product. They are self-contained; no parent workspace is required.

## Mandatory official-rule gates

Before application/contract implementation or a material qualification change:

1. Open <https://hackathon.tum-blockchain.com/prizes> and select the actual **API3** tab. A `#api3` URL can still expose the default BSV content; verify sponsor text and expand all qualification/submission/judging sections.
2. Read the general submission tab, <https://hackathon.tum-blockchain.com/prizes#how-to-submit>, separately.
3. Follow the official starter/guides below. Record the Europe/Berlin check time and requirement → implementation → actual evidence mapping in `TRACK_REQUIREMENTS.md`. Keep mandatory qualification/submission items separate from optional examples and judging preferences.
4. Before reporting readiness, reopen the correct API3 and general sections and record the finish recheck. Give each mandatory item `PASS`, `PENDING`, `FAIL` or `BLOCKED`. A plan, fixture or HTTP 200 is not live qualification evidence. Carry unresolved mandatory items into the morning handoff.

Official sources:

- <https://hackathon.tum-blockchain.com/prizes#api3>
- <https://hackathon.tum-blockchain.com/prizes#how-to-submit>
- <https://github.com/api3dao/airnodehub-hackathon-starter>
- <https://api3dao.github.io/airnodehub-hackathon/docs/from-api-to-contract>
- <https://api3dao.github.io/airnodehub-hackathon/docs/integrations>
- <https://api3dao.github.io/airnodehub-hackathon/docs/projections>

The required API3 demonstration is a valid signed response producing a meaningful on-chain action and rejection of four real-envelope variants: edited value, authentic but stale response, different request and wrong signer. Verify the intended custom error and unchanged protected state; an unrelated revert does not establish a tamper-case PASS. Judges need a direct response submission route. The public source/setup README, detailed description and video of at most 2.5 minutes remain separate submission deliverables. Recheck the published deadline; the last read general rule stated **31 October 2026, 15:00 Europe/Berlin**, one entry per team and up to three partner tracks.

## Product and oracle boundaries

The V1 working template is **Nodary ETH/USD, first accepted source observation in a fixed window**. The separately authorized V2 recipe scope is defined above. Runtime Ollama `qwen3:4b` at `http://127.0.0.1:11434` must receive real provider data and return a structured bounded proposal. Do not replace it with deterministic fixtures and call the result an LLM agent. Keep shared runtime requests short/bounded; do not stop or reconfigure an existing shared Ollama service.

- The model selects only the allowed template, YES/NO side and -25/0/+25 bps threshold offset. A strict independent validator derives the price threshold, timings and executable rule. Model prose cannot alter policy, signer, recipient, calldata or payout.
- The fixed upstream is Nodary `latestFeeds`, `name: ETH/USD`, projection `price: /ETH~1USD/value`, `updatedAt: /ETH~1USD/timestamp`.
- Pin signer `0xE70f1e8b22a21e4Bb5188918a3033341b281E4c0` and request hash `0x180eae9387bb66a72380e61ebe0a00d19f8414a716a37ebe1df124b66acfff66` before exposure. Preserve original signed UTF-8 data bytes.
- Trading closes before observations are eligible. The contract uses `price > threshold`; equality is NO. Envelope age and source age are checked separately, each at most 120 seconds, with 5-second future tolerance. Source milliseconds are normalized explicitly.
- The observation must fall within the immutable window. The first valid submission accepted on chain determines the result; keeper delay/ordering therefore matters. This is not an exact-T historical price or proof of a continuous price condition. Missing qualifying data leads to void/refund.
- Anyone may submit evidence and trigger a claim; funds always go to the stored beneficiary. There is no administrator policy-edit or reserve-withdrawal path.
- Authentication proves the signer/request/data binding, not upstream truth, provider independence or profitable forecasting. Keep the model outside settlement authority.
- Official verifier/JSON helpers and Solidity dependencies are vendored at pinned revisions with licenses. See `contracts/vendor/PROVENANCE.md`, `lib/README.md` and `foundry.lock`; do not silently update moving dependencies.

PandaScore has separately verified paid discovery/metadata calls, not a completed market lifecycle. A future implementation needs distinct creation and final observations, pinned opponent IDs, nullable-field handling and immutable finality/cancel/draw/void policy. Do not claim arbitrary new AirnodeHub API listing deployment. Do not add BSV or a relay and describe it as native API3 verification without new explicit scope and evidence.

## Agent payment, limits and retry safety

The buyer pays valueless **FMCT** to the pinned Base Sepolia market for a position. A distinct local counterparty test role funds the opposite equal stake. These roles are controlled by this installation; they are not independent real customers. Nodary is free. Test aUSD paid to the PandaScore provider is a separate data fee, not market collateral or evidence of a completed market.

- An initial bounded mandate must name chain/token, allowed contract/tools, payer, recipient, fixed beneficiary, integer per-action/total stake caps, action count, gas/API limits and expiry.
- `FactMarket` enforces stake/total/action/expiry limits **per mandate ID**, fixed caller-beneficiary/factory/token and duplicate-intent protection. This is not account abstraction or a session key. The role's full signing key can authorize another mandate; the overall trust boundary includes the isolated small test wallet and deterministic local executor.
- Pin deployment and role addresses. Fail closed if they change. The model never receives keys or arbitrary transaction authority. Approve only the exact required stake.
- Journal exact signed transaction/hash before broadcast and reconcile it before a new signature. Retain pending reservations. A restart, duplicate tool call or timeout must not create a second payment. Never delete journals as a retry strategy.
- Respect the executor's exclusive process lock. Stop the server before mutating CLI commands; do not race separate in-memory state writers or same-role nonces.
- Stop new signatures at mandate expiry/budget exhaustion. Permissionless contract claim/refund rights continue separately; do not silently issue a fresh mandate or top up.
- EIP-1559 bounds L2 gas. Base L1 fees are protocol-priced; reserve conservatively, reconcile actual L1/L2 receipt fees and label incomplete accounting. App-side gas/tool controls are not on-chain guarantees of final L1 fees.
- Reverts spend gas. A successful external data purchase may remain charged when later validation fails; do not promise its fee is reversed. Invalid evidence must not move market reserves or create payout rights.

## Credentials and local execution

Use `.local/test-wallets.json` or the ignored `WALLET_FILE` setting, with mode **0600**. Validate `testOnly: true`, `chainId: 84532` and `roles.deployer/buyer/counterparty` key/address agreement. Read only this project's roles. Never log/publish keys, recovery phrases or signed x402 payment authorization headers. No real-value funds.

Keep `.env`, `.local`, wallets, journals and signed raw transactions ignored and inaccessible from Vite/static routes. Publish `.env.example` placeholders, public ABIs and sanitized receipt/evidence records only. Never send keys to the browser or model. The committed deployment/evidence is historical public data; a fresh clone needs its own isolated test roles/deployment and must not invent balances.

## Verification and delivery

Prioritize the risky integration, then the smallest useful payment→state-change→collection flow, required failure evidence, interface and handoff. Reduce breadth before weakening that flow.

- Run `npm test`, `forge test -vv` and `npm run build` as relevant. Reserve accounting, duplicate funding/claim, expiry, transfer rollback, reentrancy, source/window semantics and void/refund need meaningful coverage.
- Exercise the real browser flow and inspect desktop/tablet/phone screenshots. Keep the source-bound resolution card central; use restrained light editorial surfaces/green data emphasis. No invented metrics, transactions or success states, dead controls, repeated demo labels or decorative dashboard chrome.
- Distinguish fixture/unit tests from actual testnet transactions. Four required oracle failures must be tied to authentic envelopes, the intended rejection reasons and protected-state evidence.
- Preserve chain history when creating fresh sample markets. Record commands, contract/network/explorer links and trust limits.
- Deliver README, environment example, lockfile, public source, `TRACK_REQUIREMENTS.md`, concise `MORNING_HANDOFF.md` and `SUBMISSION.md` with a 150-second presentation outline. Do not call a draft outline a recorded/submitted video or claim full eligibility with mandatory items unresolved.
