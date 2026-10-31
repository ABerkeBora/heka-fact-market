# Fact Market

An agent turns a bounded question about ETH/USD into a fully collateralized test market. A pinned AirnodeHub response determines the winning side on Base Sepolia; the agent funds its position, submits the observation and collects the contract-enforced payout under one initial authorization.

The V1 template is **Nodary ETH/USD, first accepted observation in a fixed window**; V2 adds goal-selected BTC/USD with an immutable recipe per market. This is an observation market, not a historical exact-time price or proof that a price stayed above a threshold throughout a period. PandaScore paid discovery is separately verified; a complete PandaScore prediction lifecycle is not implemented. BSV qualification is not claimed.

## V1 and V2 comparison

| Version | Local route | Source rule | Isolated state |
|---|---|---|---|
| V1 baseline | http://localhost:3102/ | Fixed ETH/USD request | `.local/state.json`, original factory and roles |
| V2 | http://localhost:3102/next | Model selects ETH/USD or BTC/USD; each market pins its complete recipe | `.local/next/state.json`, new factory/token and disjoint roles |

The published `v1-baseline` tag preserves working commit `e8fb85c`. V2 lives on `codex/next`; the same UI and executor primitives are shared, while API/storage/deployment/payment namespaces are separate. See [BASELINE_V1.md](BASELINE_V1.md) and [MORNING_HANDOFF_V2.md](MORNING_HANDOFF_V2.md).

V2 recognizes one explicit supported asset in the goal, receives real signed observations for both feeds, and lets the local model select an allowlisted feed/side/offset. An independent lexical validator rejects unsupported, ambiguous or model-mismatched assets. It is deliberately not a general asset classifier. The deployed contract derives the canonical request hash itself from feed0(ETH) or feed1(BTC), then fixes source, exact operation/parameters/projection, signer, unit, predicate and observation/refund semantics in `recipeHash`; threshold/stake/chain/factory/token/windows are bound in `policyHash`. The same proposal supplies the UI and transaction arguments. A different registered feed's authentic response cannot settle the market.

Nodary is free in both versions. The real economic action is capped test-position funding and contract-enforced collection; V2 does not invent an x402 charge or add PandaScore/BSV scope.

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

## Contracts and verification

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

See [track requirements](TRACK_REQUIREMENTS.md), [morning handoff](MORNING_HANDOFF.md), and [presentation/submission draft](SUBMISSION.md) for evidence, limits and remaining submission work.

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
