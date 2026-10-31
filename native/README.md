# Native original-Airnode consumer

`consumer.cjs` instantiates the public compiled artifact in `nodary-outcome.json.gz` using pinned `scryptlib2.2.6`. It accepts the original Nodary EIP-191 signature and UTF-8 signed data. No wallet/key or backend digest is passed into the contract. Exact source and reproducibility hashes are in `PROVENANCE.json`.

The readable `contracts/` sources implement one narrow schema: `{"price":positiveDecimal,"updatedAt":13digitMillis}`. Request hash, original Airnode public key, signed/source window, threshold, complete winner output, fixed refund outputs and refund maturity are immutable constructor arguments. Packed oracle payload is bounded to135bytes. This is not a general JSON oracle VM or arbitrary API marketplace.

The contract is approximately5MB; its public compressed artifact is136KB. `OP_CODESEPARATOR` keeps its spend preimage small. Network service body/queue limits can block deployment despite a passing local interpreter. A response accepted locally is not a network-accepted transaction.

## Reproduce without a wallet

```sh
npm ci
npm run bsv:verify
# Actual pilot policy and authentic oracle response, read-only Script execution:
npm run bsv:check -- docs/evidence/bsv/native-policy.json docs/evidence/bsv/native-window-observation.json
npm run bsv:rejections
```

`bsv:verify` uses a historical authentic oracle fixture and dummy recipients/UTXO; it is explicitly local evidence. `native/evidence/` contains the independent compiler/interpreter checks, including wrong recipients/amounts, valid YES/NO, early and mature refunds, all-final-sequence rejection and SDK preimage equivalence. `docs/evidence/bsv/native-oracle-rejections.json` executes the actual pilot's immutable recipients/window against edited/stale/wrong-request/wrong-signer responses; no failing transaction is broadcast or mined.

Source recompilation needs the sCrypt1.22.0 binary, `scrypt-ts1.4.5`, `scrypt-ts-lib0.1.28` and TypeScript decorator support; the ordinary app does not execute a remote compiler or download binaries. The published artifact is pinned by hash. The current source/compiler proof is experimental, not a production audit.

There is no current-block-clock price freshness check. An original response inside the fixed observation window can settle after that window until the fixed timed refund spends the same UTXO. `nLockTime` plus a nonfinal input sequence gates the refund; the first accepted valid spend wins. The upstream source remains trusted for factual accuracy. The fee sponsor has no withdrawal branch.

Current live status: the5MB artifact is funded on Testnet but its oracle claim exceeds all tested public-node operation/time policies. New native preparation/funding is disabled. Its separate fixed refund is pending chain median time, and skipped-branch opcount admission is also unverified. Local interpreter success must not be advertised as a completed live native payout.
