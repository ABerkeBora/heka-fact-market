# VeriFi Market

*Repository, contracts and code identifiers keep the earlier working name Fact Market (`FactMarket`, `FactMarketNext`, `heka-fact-market`).*

An AI agent turns a bounded price question into a fully collateralized two-party position. Only an authenticated AirnodeHub (API3) response can decide who is paid: the signature is checked by the Solidity contract on Base Sepolia, and by the locking Script itself on BSV.

Example: *"Will ETH/USD be above $2,236.01 in the observation window?"* The agent picks YES or NO, both sides lock equal stakes, and the first accepted signed Nodary price inside the window sends the whole pool to the winner. No valid observation means both sides are refunded.

## At a glance

| | |
|---|---|
| What it is | Peer-to-peer conditional escrow for binary YES/NO questions. A proof of concept built to be extended (more sources, more participants), not an order book or AMM. |
| Data | Nodary `latestFeeds` ETH/USD and BTC/USD via AirnodeHub. Signer `0xE70f1e8b22a21e4Bb5188918a3033341b281E4c0` and the exact request hash are pinned per market. One API per market in this MVP. |
| Rule fixed before funding | Source, request, signer, threshold, window, stake and recipients are locked before any money moves: `recipeHash`/`policyHash` in the contract, an immutable locking Script on BSV. The operator cannot change them later, so no dispute step is needed. |
| Agent | Local Ollama `qwen3:4b` reads real signed prices and proposes feed, side and threshold step. Independent code validates the proposal; the model never sees keys. After one capped mandate the executor funds the position, submits the observation and triggers the payout. |
| API3 track | Base Sepolia V2: real settlements and payouts, plus four tamper rejections (edited value, stale response, different request, wrong signer) on the same open market. Judges can rerun the test without a wallet. |
| BSV track | Pay-on-verified-data escrow for agents on BSV. `/bsv/fast`: a BSV Script verifies the original API3 EIP-191 signature (Keccak + secp256k1) itself, with no relayer. Funding from BSV Desktop via the BSV SDK / Wallet Toolbox; real testnet funding and a 2,000 sat payout on WhatsOnChain. |

## Where to look

| | |
|---|---|
| API3 flow (V2) | http://localhost:3102/next — contract FactMarketNext [`0x9319e85d84beb94307e91c350209e5e429b8be34`](https://sepolia.basescan.org/address/0x9319e85d84beb94307e91c350209e5e429b8be34), Base Sepolia (84532) |
| API3 tamper test | [Judge tamper test — V2](#judge-tamper-test--v2-presented-at-next) · [Demo limits](#demo-limits-live-judging) · [Agent payments](#agent-payments-real-testnet-transactions) |
| BSV flow | http://localhost:3102/bsv/fast — [funding](https://test.whatsonchain.com/tx/42926a8684b7bd7d1e1643ac273266a043859cb19c0af1b36bf5653806ac8de9), [2,000 sat payout](https://test.whatsonchain.com/tx/486b0e718f95538e8e2881ee36ea310e8c61b3aa9fb65feb567580ee25f8603e), [timed refund](https://test.whatsonchain.com/tx/114518d7f422662132ed9014512035b985d2320cfa378cf55701786e07e7e3ab); status in [BSV native flow](#bsv-native-flow-bsvfast) |
| Original baseline (V1) | http://localhost:3102/ — fixed ETH/USD, kept unchanged |
| Submission text | [SUBMISSION.md](SUBMISSION.md) · evidence in [docs/evidence](docs/evidence) · build history in [docs/history](docs/history) |

## Agent payments (real testnet transactions)

VeriFi Market is a pay-on-verified-data rail for agents: money moves only when an authenticated data response says so. The prediction question is the first template; the same pattern can condition an agent's payment on any AirnodeHub-signed fact (a flight landed, a delivery, a weather reading), which is not implemented yet.

| Step | Base Sepolia (API3 track) | BSV testnet (BSV track) |
|---|---|---|
| Agent pays for data (x402) | Two PandaScore calls, 0.01 test aUSD each, under a capped mandate: [discovery](https://sepolia.basescan.org/tx/0xe95f2ac7498a1dce74004f66a5997dbcd9c32936721e731d77d0de31e15c4ead), [match metadata](https://sepolia.basescan.org/tx/0xe209b8ef317235d947e84d66f8ee545c5d603ef583eaf2392725a9201cf2e9cb). Data purchase only — no market was settled from it. Nodary, used for settlement, is free. | — |
| Agent funds its position | ETH/USD [1 FMCT](https://sepolia.basescan.org/tx/0xf20a13dd83fa805dcc25fe8f70c7ad1f7b94e86efcdfbc917ebe67b9f8efac94), BTC/USD [1 FMCT](https://sepolia.basescan.org/tx/0x55d2a83853ede4f6dc16044debb92716c4f17061ad25d2f488e447ef455113e6) | 1,000 sat stake from BSV Desktop wallet-derived inputs in [pool 1 funding](https://test.whatsonchain.com/tx/42926a8684b7bd7d1e1643ac273266a043859cb19c0af1b36bf5653806ac8de9) and [pool 2 funding](https://test.whatsonchain.com/tx/00e13304fc82ed7f22f1db062afc89eb9aaf2fe22c9f39d979153a2256aa3099) |
| Verified data releases the money | [ETH/USD 2 FMCT payout](https://sepolia.basescan.org/tx/0xfe5fd704bbea10f24ee542f296e376827244c3e07d6d5600a9dd9e25c13e1986), [BTC/USD 2 FMCT payout](https://sepolia.basescan.org/tx/0x65ee96e4bf86ce3b243d4968de571d391ea7d76df2c8346f27a1ea7ba3c60357) | [2,000 sat payout](https://test.whatsonchain.com/tx/486b0e718f95538e8e2881ee36ea310e8c61b3aa9fb65feb567580ee25f8603e) (Script-verified API3 signature); no data → [timed refund 1,000/1,000](https://test.whatsonchain.com/tx/114518d7f422662132ed9014512035b985d2320cfa378cf55701786e07e7e3ab) |

## Demo limits (live judging)

- The API3 tamper test runs live at http://localhost:3102/judge.html (one button, in the browser) or with `npx tsx scripts/judge-next.ts` — no wallet, no gas.
- This installation's V2 test roles have used their one-time FMCT faucet, so no new live V2 market can be funded here; a fresh install creates its own roles with `npm run next:setup`. Recorded lifecycles are shown instead.
- New BSV pools need the operator's explicit go-ahead and a funded fee sponsor ([runbook](docs/BSV_FAST_RUNBOOK.md)); the recorded pools are shown.
- New model proposals need local Ollama with `qwen3:4b`; recorded model calls are in `docs/evidence/v2/agent-runs.json`.

## Trust model

A valid signature proves which provider signed the response and that nobody changed it; it does not prove the provider's number is true. Markets use providers from a short hand-picked AirnodeHub list, and participants accept that provider risk — the assumption rests on the providers' reputation. Signature checks remove the platform from the trust path: the operator cannot pick, edit or replace the deciding value. Binding one market to two or three independent providers that should agree is the next step (see [Next](#next-not-implemented)).

## Known limitations

1. **First accepted observation.** Any valid in-window response settles the market, so the side that benefits can choose when to submit within the 5-minute window. A signed point-in-time close would remove this; it is not integrated yet.
2. **Test counterparty.** Both sides are test roles controlled by this installation. The flow is real; the market participants are not independent.
3. **BSV refund timing.** The refund branch is time-locked against chain median time, which lags wall-clock time by about an hour on testnet, so a "17-minute" refund becomes available much later (observed: unlock 11:24 UTC, spendable and broadcast 12:28 UTC).
4. **BSV funding chronology.** For the recorded BSV pools, node validation of the funding was first observed after the observation window had opened. The payout itself is node-validated. Fixed in code after these pools: the window now opens 25 minutes after market creation instead of 10, and funding validated only after the window opens still falls back to the refund. This change has not been exercised by a live pool yet.
5. **BSV tamper test is local.** The four rejected BSV cases run the real Script in a local VM against the funded policy; they are not node-rejected transactions. The on-chain tamper evidence is on Base Sepolia.
6. **Experimental routes.** `/bsv` (a relay where one backend holds the attestor key — custodial) and `/bsv/native` (an older 5 MB Script blocked by node policy) are kept as history and are not part of the product.
7. Testnet only, valueless assets, no security audit.

## Next (not implemented)

- **Two or three sources per market.** Store a list of (signer, request hash) pairs in the market and settle only when *k* of *n* signed values agree within a tolerance. On EVM this is a contract change plus a new deployment; on BSV every extra signature check enlarges the Script, so the size budget has to be measured first.
- **User-opened markets from the curated catalogue.** Recipes already live in one registry (`server/next/registry.ts`) and each market pins its own recipe hash; the deployed contract currently accepts feed IDs 0 and 1 only, so new providers need a registry entry and a new deployment.
- **Point-in-time sources** such as CoinPaprika daily history or Blocksize 30-minute closes, to replace the first-accepted-observation rule.
- **More than one participant per side.**

## V1 and V2 comparison

| Version | Local route | Source rule | Isolated state |
|---|---|---|---|
| V1 baseline | http://localhost:3102/ | Fixed ETH/USD request | `.local/state.json`, original factory and roles |
| V2 | http://localhost:3102/next | Model selects ETH/USD or BTC/USD; each market pins its complete recipe | `.local/next/state.json`, new factory/token and disjoint roles |

Sources: [V1 tag](https://github.com/ABerkeBora/heka-fact-market/tree/v1-baseline) · [V2 branch](https://github.com/ABerkeBora/heka-fact-market/tree/codex/next).

The published `v1-baseline` tag preserves working commit `e8fb85c`. V2 lives on `codex/next`; the same UI and executor primitives are shared, while API/storage/deployment/payment namespaces are separate. See [docs/history/BASELINE_V1.md](docs/history/BASELINE_V1.md) and [docs/history/MORNING_HANDOFF_V2.md](docs/history/MORNING_HANDOFF_V2.md).

V2 recognizes one explicit supported asset in the goal, receives real signed observations for both feeds, and lets the local model select an allowlisted feed/side/offset. An independent lexical validator rejects unsupported, ambiguous or model-mismatched assets. It is deliberately not a general asset classifier. The deployed contract derives the canonical request hash itself from feed0(ETH) or feed1(BTC), then fixes source, exact operation/parameters/projection, signer, unit, predicate and observation/refund semantics in `recipeHash`; threshold/stake/chain/factory/token/windows are bound in `policyHash`. The same proposal supplies the UI and transaction arguments. A different registered feed's authentic response cannot settle the market.

Nodary is free in both versions. The real economic action is capped test-position funding and contract-enforced collection; V2 does not invent an x402 charge or add PandaScore/BSV scope.

## BSV native flow (`/bsv/fast`)

**http://localhost:3102/bsv/fast** is the BSV-native flow (proof of concept). Status as of the 12:51:55 Berlin network snapshot: the optimized Script has executed a real 2,000 sat outcome payout: [first funding](https://test.whatsonchain.com/tx/42926a8684b7bd7d1e1643ac273266a043859cb19c0af1b36bf5653806ac8de9) is MINED, and [payout](https://test.whatsonchain.com/tx/486b0e718f95538e8e2881ee36ea310e8c61b3aa9fb65feb567580ee25f8603e) has full-node UTXO validation but is UNCONFIRMED. The [second funding](https://test.whatsonchain.com/tx/00e13304fc82ed7f22f1db062afc89eb9aaf2fe22c9f39d979153a2256aa3099) is now MINED in block 1766140; its [timed refund](https://test.whatsonchain.com/tx/114518d7f422662132ed9014512035b985d2320cfa378cf55701786e07e7e3ab) (1,000 sat back to each side, fee from a separate input) was broadcast at 12:28 UTC, once chain median time passed 11:24:10 UTC.

**Native readiness is false for this run.** Strong input-spend/output-creation validation was observed at 11:29:52 UTC, after the observation windows. Earlier HTTP 200/public/raw observations established transport and public commitment, not validated prefunding before the outcome could become known. They cannot be promoted retrospectively into proof of a fair prefunded prediction. Current code distinguishes these stages, requires UTXO validation before accepting a new funding state, and takes the refund path when validation is only observed after the window starts. See [the first validation observations](docs/evidence/bsv/fast-node-utxo-validation.json) and [latest node evidence at 12:51:55 Berlin](docs/evidence/bsv/fast-node-utxo-validation-final.json).

The native contract checks the original API3 EIP-191 signature itself, exact request, source/signature observation window and full 2,000 sat winner output. A fixed timed branch protects 1,000/1,000 refund shares; fees come from a separate input. The saved refund can be reconciled after agent mandate expiry without a new signature. Nodary is free. There is no EVM verifier or relayer decision key in this native route.

Use [the native runbook](docs/BSV_FAST_RUNBOOK.md) for setup, recovery and the evidence boundaries. SDK 3.2.1, Wallet Toolbox 2.14.9 and scryptlib 2.2.6 stay pinned; value keys remain in the standard wallet. Native data is isolated under `/api/bsv/fast` and ignored `.local/bsv/fast/`. The first accepted eligible observation sets the result; there is no exact-second quote, upstream-truth guarantee or production security audit.

Historical experiments are preserved. The old `/bsv/native` 5 MB pool still has resource-blocked recovery; no further recovery attempt was added in this delivery. `/bsv` paid 1,900 sat through a relay whose backend controls both attestor and opposing-role keys, so that history is not native/non-custodial qualification evidence. Read [docs/history/BSV_HANDOFF.md](docs/history/BSV_HANDOFF.md) and [TRACK_REQUIREMENTS_BSV.md](TRACK_REQUIREMENTS_BSV.md) for the separate statuses. Video recording/upload and Devfolio submission remain undone.

## Run locally

Node.js >=22.18, npm and Foundry are required. No hosted service is needed beyond the public testnet and oracle endpoints. The UI uses a locally running Ollama `qwen3:4b` model.

```sh
npm ci
cp .env.example .env
forge build
npm run dev
```

Open **http://localhost:3102**. The server binds to loopback only. For a production bundle:

```sh
npm run build
npm start
```

A fresh clone must configure its own isolated test roles, deploy, and fund them before authorizing a new market. The committed deployment evidence is a public historical record; it is not an imported wallet or fabricated local balance.

Create `.local/test-wallets.json` (mode `0600`) with **test-only Base Sepolia keys**:

```json
{
  "testOnly": true,
  "chainId": 84532,
  "roles": {
    "deployer": { "address": "0x...", "privateKey": "0x..." },
    "buyer": { "address": "0x...", "privateKey": "0x..." },
    "counterparty": { "address": "0x...", "privateKey": "0x..." }
  }
}
```

Set `WALLET_FILE` in `.env` if the private file is elsewhere. Never place keys in source, model prompts, browser fields or public evidence. Give the three roles a small amount of Base Sepolia test ETH for gas. FMCT is minted by the app's once-per-address faucet and has no monetary value. It is separate from the test aUSD used for paid provider calls.

```sh
chmod 600 .local/test-wallets.json
npm run chain:deploy
npm run dev
```

Deployment writes ignored `.local/deployment.json`; signed transactions and jobs are journaled in ignored `.local/state.json`. Do not delete these journals to retry a timed-out action. Restore the same role/deployment configuration and use **Reconcile and resume**. The executor reconciles the original signed hash before it can sign another intent. Server and mutating CLI commands use an exclusive process lock; stop one before starting another.

## Customer flow

1. Enter an ETH/USD observation goal and a stake between 0.1 and 10 FMCT, then **Draft market**.
2. Ollama receives actual fresh Nodary data and selects only an allowed template, side and offset of -25/0/+25 basis points. A separate strict validator rejects unknown fields, templates, destinations and offsets. Thresholds and timing are derived deterministically.
3. Review the resolution card and bounded mandate: fixed source, signer, exact request/projection, threshold, beneficiary, contract/token, one position, budget and expiry.
4. **Authorize agent** once. The executor registers on-chain mandates, obtains FMCT, approves only the exact stake, creates the fixed policy, and funds buyer and the separate opposing test role. These are distinct test wallets controlled by this local installation, not independent real customers.
5. After trading closes, the agent obtains a qualifying source observation, submits its exact signed bytes and triggers the winning beneficiary's claim. Missing valid data by the deadline means void/refund. Free observation polling is bounded to 32 calls; transient provider failures retain collateral and retry only inside the approved window. Unmatched positions refund after trading closes.

The predicate is strictly `price > threshold`; equality means NO. Source observation and envelope signature times are shown separately. The observation must be inside the immutable window; envelope/source age must each be <=120 seconds, with a 5-second future tolerance. The first valid response accepted on chain selects the result, so submission order and keeper delay are part of the disclosed trust/economic model.

## Delegation and payment boundaries

The buyer pays FMCT into the pinned market contract for one test position; the separate counterparty pays an equal opposing position. The paid result is a collateralized claim governed by a fixed oracle rule. The executor later initiates the funded contract's settlement and fixed-beneficiary collection. No payment click is required for each step after initial authorization.

Each on-chain mandate binds its caller/beneficiary, the factory and token, per-action stake, cumulative stake, action count and expiry. Unique intents prevent a position being funded twice. Each stake consumes the exact ERC20 allowance. These are **per-mandate limits**, not account abstraction or session keys: possession of a role's private key can authorize another mandate. The trust boundary is an isolated small test wallet plus the deterministic local executor. The model never sees keys and cannot create arbitrary calldata.

The executor caps the signed L2 gas budget and reserves conservatively for Base's L1 data fee. L1 pricing is protocol-controlled and cannot be hard-capped by EIP-1559; actual receipt fees are reconciled, and missing fee data retains the full reservation. Gas caps and allowed-tool checks are application controls. Reverted transactions spend gas; an already settled external API fee is not refunded because a later oracle or market step fails. No automatic top-ups occur.

Nodary calls are free. Two separately bounded PandaScore x402 purchases cost **0.02 test aUSD total**, paying the provider for upcoming-match discovery and match metadata. Their receipt/signature evidence is in `docs/evidence/pandascore-paid-discovery.json`; these calls do not establish a completed PandaScore market. Re-running the completed provider smoke reuses its results without paying again. An uncertain paid HTTP request stops for nonce/receipt reconciliation instead of generating another payment authorization.

## Judge tamper test — V2 (presented at `/next`)

Contract: **FactMarketNext `0x9319e85d84beb94307e91c350209e5e429b8be34`** on **Base Sepolia (84532)** · test FMCT `0xd6e4968b75422dfb13759138808a4310cec061b3` · ABI `docs/FactMarketNext.abi.json` · pinned Nodary signer `0xE70f1e8b22a21e4Bb5188918a3033341b281E4c0`. `settle(marketId,timestamp,data,signature)` is permissionless; `data` must be the original signed JSON string.

**1. No wallet, no setup beyond `npm ci` (read-only replay).** `scripts/judge-next.ts` calls the deployed contract with `eth_call` at block 52479897, when ETH/USD market 1 was open, matched and inside its observation window (it settled for real in the next block, 52479898). The contract code decides; nothing is signed or spent.

```sh
npm ci
npx tsx scripts/judge-next.ts --case valid --save valid.json   # real accepted response → ACCEPTED
npx tsx scripts/judge-next.ts --case edited-value              # → NotSignedByAirnode
npx tsx scripts/judge-next.ts --case stale-real-response       # → ResponseTooOld
npx tsx scripts/judge-next.ts --case different-request         # authentic BTC/USD response → NotSignedByAirnode
npx tsx scripts/judge-next.ts --case wrong-signer              # same data, other key → NotSignedByAirnode
# Your own variant: edit one field of valid.json, or re-sign it with any key, then
npx tsx scripts/judge-next.ts --file valid.json
```

Set `RPC_URL` if the public endpoint rate-limits. A fresh response fetched today fails at that historical block with a timing error, as it should; use a fresh market (route 2) for live responses.

**2. Live transactions on a fresh market.** On the running instance, draft and authorize a new market at `/next`, then paste an envelope into its **Evidence** form, or `POST /api/next/markets/:id/submit` with `{"envelope":{"timestamp":"…","data":"<original string>","signature":"0x…"}}`. This sends a real Base Sepolia transaction from the local test role and spends test gas. Limit: a market trades for 2 minutes, then observes for 5 minutes, and the agent submits the first valid observation within about 10 seconds of the window opening, so tamper submissions must be sent in that short gap. Judges can also call `settle` directly from their own Base Sepolia test wallet with the public ABI.

**Recorded on-chain tamper test (market 1, all before its valid settlement):** edited value [0xc1a6…3d53](https://sepolia.basescan.org/tx/0xc1a665252860449ee958a19df48f766bcc1fe5a7b200f8836ef5707c38ec3d53) (block 52479836), authentic stale [0x47b6…d62a](https://sepolia.basescan.org/tx/0x47b6e1f8107306d3ed992b4f7d754c4d74aa36f105d352076bf077152134d62a) (52479847), different request [0xaaa0…185e](https://sepolia.basescan.org/tx/0xaaa02958973f4cf9a19b19dc28247ab63d236d0e66f5b6f606d68ce4390b185e) (52479857), wrong signer [0x471e…2c05](https://sepolia.basescan.org/tx/0x471ef300ee8d7ac629e77d34f68f19519b28f2bf84ed18b0a79f3dd5d8542c05) (52479869) — all reverted; then valid settlement [0x701b…ea54](https://sepolia.basescan.org/tx/0x701bb3d8904b7f603473cc5849e75b88a50858e078f7f2e03c80d590a426ea54) (52479898) and 2 FMCT payout [0xfe5f…1986](https://sepolia.basescan.org/tx/0xfe5fd704bbea10f24ee542f296e376827244c3e07d6d5600a9dd9e25c13e1986) (52479912). `npx tsx scripts/next-verify.ts --public` re-checks every exact custom error and the unchanged reserve.

## Contracts and verification — V1 baseline (`/`)

Network: **Base Sepolia (84532)**. See [deployment evidence](docs/evidence/deployment.json) for contract addresses and explorer transactions. Public ABIs are in `docs/FactMarket.abi.json` and `docs/TestCollateral.abi.json`.

Anyone can call `settle(marketId,timestamp,data,signature)` directly on the deployed factory. The app's **Evidence** tab accepts an envelope, and this script bypasses the off-chain provider verifier so the deployed contract is authoritative:

```sh
# Stop the app server first. Uses the existing local market job and its gas mandate.
npm run judge:submit -- MARKET_ID response.json
```

The contract verifies the expected signer, the request hash computed before exposure, both timestamps, the observation window and one-time settlement. `data` must be the original signed JSON string, not parsed and reserialized bytes. Once a market is settled, use a fresh market for an oracle tamper demonstration; replay against a settled market only proves single-settlement protection.

```sh
npm test
forge test -vv
npm run build
# Spends isolated test funds, calls real local LLM and creates a real test market:
npm run chain:smoke
# Verifies each recorded tamper transaction's exact custom error at its historical block:
npx tsx scripts/verify-tamper.ts
# Read metadata and an actual 402 challenge without paying:
npx tsx scripts/provider-smoke.ts
```

`chain:smoke` persists its run; it does not silently spend again when rerun. A fresh sample is created through Draft market → Authorize agent. Keep previous chain history and journals.

## Source and trust

The immutable oracle signer is Nodary `0xE70f1e8b22a21e4Bb5188918a3033341b281E4c0`; exact ETH/USD request hash is `0x180eae9387bb66a72380e61ebe0a00d19f8414a716a37ebe1df124b66acfff66`. See `server/provider.ts` for operation, parameters and projection. Official API3 libraries are vendored at pinned revisions with licenses/provenance. The local model can propose and explain; it has no settlement authority.

An authentic signature proves who signed the exact response to the fixed request. It does not prove upstream truth, market profitability or resistance to provider manipulation. The first accepted observation rule has keeper/ordering selection risk. No platform administrator can change the stored policy or withdraw reserves. This code is for valueless test use, not audited production wagering.

See [track requirements](TRACK_REQUIREMENTS.md), [morning handoff](docs/history/MORNING_HANDOFF.md), and [presentation/submission draft](SUBMISSION.md) for evidence, limits and remaining submission work.

## V2 setup and verification

After configuring your own V1 test roles as above, stop the server before the exclusive setup command:

```sh
npm run next:setup
npm run build
npm start
```

`next:setup` generates three separate `fact-market-next` test roles at mode0600 and grants each at most0.0005 Base Sepolia test ETH from this project's V1 deployer (at most0.0015 test ETH total, plus setup gas). This is a one-time setup grant, not customer payment or an automatic top-up. It deploys a separate FMCT and FactMarketNext. Existing grants/deployments reconcile their original signed transactions rather than paying again. All V2 keys/journals/deployment are under ignored `.local/next/`; `NEXT_WALLET_FILE` may select another private file, but role namespace and address-disjointness checks prevent V1 key reuse. Wallet files inside the checkout must remain under ignored `.local/`.

```sh
# Real model/funding/settlement tests; stop app server first:
npm run next:smoke
# Public replay: no private roles/journals or wallet needed:
npx tsx scripts/next-verify.ts --public
# Full retention audit in the preserved workspace with its original private journals:
npx tsx scripts/next-verify.ts
```

The V2 smoke creates/funds both actual feeds, rejects four oracle variants plus both wrong-feed directions, settles/collects, then runs a new V1 ETH/USD lifecycle through the shared engine. Original V1 receipts/evidence remain intact; that intentional V1 regression appends one job to the V1 journal and publishes its new record separately under `docs/evidence/v2/`. Re-running a completed smoke reuses the journal instead of creating more positions. V2 private state is not served through HTTP; `/api/next/*` never looks up or acts on a V1 job.

See `docs/evidence/v2/` for new evidence. Video recording and Devfolio submission remain team actions; the local comparison does not imply a completed competition entry.
