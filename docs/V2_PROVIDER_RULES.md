# V2 bounded Nodary provider registry

Verified **31 October 2026, 04:39 Europe/Berlin** against the live official metadata at <https://airnode-nodary.fly.dev/> and two actual signed POST responses. Evidence: [provider-registry.json](evidence/v2/provider-registry.json). No keys, payment authorizations, test collateral transfers or x402 fees are involved in this read-only proof. `latestFeeds` is free.

## Fixed recipes

| Feed ID | Feed | Operation / parameters | Projection | Unit |
|---|---|---|---|---|
| 0 | ETH/USD | `latestFeeds`, `{"name":"ETH/USD"}` | `price: /ETH~1USD/value`, `updatedAt: /ETH~1USD/timestamp` | USD per ETH, 18 decimals |
| 1 | BTC/USD | `latestFeeds`, `{"name":"BTC/USD"}` | `price: /BTC~1USD/value`, `updatedAt: /BTC~1USD/timestamp` | USD per BTC, 18 decimals |

Both use the fixed endpoint above and signer `0xE70f1e8b22a21e4Bb5188918a3033341b281E4c0`. The official metadata explicitly lists both feed names as examples, declares the `latestFeeds` operation, and declares the optional string `name` parameter. Actual signed responses independently establish that both projected fields exist for both recipes. An absent feed would cause a missing projection error; that error is not signed evidence of nonexistence.

| Feed | Exact request hash | Recipe hash |
|---|---|---|
| ETH/USD | `0x180eae9387bb66a72380e61ebe0a00d19f8414a716a37ebe1df124b66acfff66` | `0xb5c7078fd74dfe81d42c362088dee2f71bbffb6f406dd0693946e22c3d550840` |
| BTC/USD | `0x78094ba4768ebdadb2012f2de22e779ce0992ecc290ebab208233addaaef106a` | `0x5329d4927aaa5c9bff0c9e6859e2b313f5cfbc8f9087a85d288e5ca5904d2fd2` |

Request hashing uses the pinned official starter's canonical UTF-8 key ordering and binds operation, parameters and projection. Response verification recovers the signer of the EIP-191 signature over the exact request hash, timestamp and untouched signed UTF-8 data bytes. The response's self-reported signer/hash cannot select another recipe.

`deriveRecipeHash` matches the contract's ABI formula:

```text
keccak256(abi.encode(
  keccak256("FACT_MARKET_RECIPE_V2"), uint8(feedId), signer, requestHash,
  keccak256("https://airnode-nodary.fly.dev/"), keccak256("USD"), uint8(18),
  keccak256("GT"), keccak256("FIRST_ACCEPTED_FRESH_SOURCE_IN_WINDOW_ELSE_VOID"),
  uint256(120), uint256(120), uint256(5)
))
```

The feed ID and exact request identify the base asset, while the unit code is USD. The human unit label is USD per ETH or USD per BTC. The concrete market policy additionally binds chain, contract, collateral, threshold, stake and trading/observation windows before funding.

## Goal and model boundary

`recognizeGoalFeed(goal)` executes before the model or funding. It accepts exactly one supported asset family: ETH / Ether / Ethereum, or BTC / Bitcoin. Both families in one goal are ambiguous and rejected; no supported asset means no automatic selection. Unknown uppercase tickers of 2–12 characters (except supported asset aliases ETH/Ether/Ethereum and BTC/Bitcoin, plus USD, YES, NO, AI, API and GT), known unsupported asset names/tickers, unsupported explicit BASE/QUOTE pairs, unsupported quote currencies and unsupported dollar-prefixed tickers are rejected even when a supported asset is also present. This is a bounded lexical recognizer, not a general natural-language asset classifier.

`validateModelFeed(goal, feedId)` repeats that independent goal recognition and rejects a model-selected feed that differs from the goal. The model cannot introduce an endpoint, signer, arbitrary feed, projection, operation, comparator, unit or settlement window. The product title and executable rule must be generated from the accepted registry recipe and fixed predicate rather than relying on the model's explanation.

Thirteen reproducible recognition cases are captured by `scripts/next-provider-proof.ts`, including unsupported SOL, DOGE, UNI/Uniswap and an unregistered FOO ticker, mixed supported/unsupported assets, ambiguous ETH+BTC, no named asset, a non-USD quote, and a schema-valid model choice of ETH for a BTC goal. Four additional cases invoke the actual proposal entry point with HTTP disabled: SOL, UNI with Bitcoin, unknown FOO with BTC, and ambiguous ETH plus BTC. Each records zero HTTP calls, unchanged job/proposal counts and no submitted payment. Proof cases are validator evidence; they are not payment or settlement evidence.

## Observation and trust policy

The predicate is **price > fixed threshold**. Settlement uses the first qualifying fresh source observation accepted on chain inside the immutable observation window after trading closes. It is not a historical exact-T price, a continuous threshold claim, or a promise of profitability. No accepted observation by the deadline means the fixed void/refund rule.

Envelope age and source age are separately capped at 120 seconds; future tolerance is 5 seconds. Nodary `updatedAt` is milliseconds, while the envelope timestamp is seconds. Missing, malformed, nonpositive, stale or future data is rejected. During settlement the contract must also enforce that the source timestamp is inside the market's pinned window.

An authenticated Airnode response proves who signed the exact response to the exact request. It does not establish upstream truth, remove provider/manipulation/availability risk, or resolve the transaction-order dependence of a first-accepted-observation policy. A fresh signature can cover an older upstream observation; the source timestamp check is essential.

## Reproduction

```sh
npx tsx scripts/next-provider-proof.ts
```

The script refreshes only the V2 public provider proof, uses no wallets and creates no transactions. Its recorded signed response is a timestamped snapshot and will become stale; it must not be reused as fresh settlement data. Live market operation fetches another response through the fixed recipe.

Primary sources: <https://airnode-nodary.fly.dev/>, <https://github.com/api3dao/airnodehub-hackathon-starter/tree/52933ae1fb9371446a927338473466c3d320e19a>, <https://api3dao.github.io/airnodehub-hackathon/docs/projections>, <https://api3dao.github.io/airnodehub-hackathon/docs/from-api-to-contract>.
