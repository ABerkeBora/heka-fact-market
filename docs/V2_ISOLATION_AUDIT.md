# V2 isolation and historical evidence audit

Verified 2026-10-31T03:40:57.530Z. Status: **PASS**. Network: Base Sepolia (84532). This verifier performs read-only RPC, filesystem and Git reads. It loads no wallet and submits no transaction.

## Live results

- **ETH/USD** market 1: actual agent funding [0xf20a13dd…](https://sepolia.basescan.org/tx/0xf20a13dd83fa805dcc25fe8f70c7ad1f7b94e86efcdfbc917ebe67b9f8efac94), separate counterparty funding [0xbb073d67…](https://sepolia.basescan.org/tx/0xbb073d67a5e114b6da50f170c6c6bcc3c6c99c62dcc85d4f8bdd504e1eed5b5f), authenticated settlement [0x701bb3d8…](https://sepolia.basescan.org/tx/0x701bb3d8904b7f603473cc5849e75b88a50858e078f7f2e03c80d590a426ea54), fixed-beneficiary payout [0xfe5fd704…](https://sepolia.basescan.org/tx/0xfe5fd704bbea10f24ee542f296e376827244c3e07d6d5600a9dd9e25c13e1986). Remaining reserve: 0.
- **BTC/USD** market 2: actual agent funding [0x55d2a838…](https://sepolia.basescan.org/tx/0x55d2a83853ede4f6dc16044debb92716c4f17061ad25d2f488e447ef455113e6), separate counterparty funding [0x3be26117…](https://sepolia.basescan.org/tx/0x3be26117929854b385e544fe6e5615b5c746aa8b0d4d2b8c211275cdcc0dcd02), authenticated settlement [0xceb91a16…](https://sepolia.basescan.org/tx/0xceb91a16c9d09fbe9a1843058490cdd7187fe011f92907b7e5279c3d3587a75e), fixed-beneficiary payout [0x65ee96e4…](https://sepolia.basescan.org/tx/0x65ee96e4bf86ce3b243d4968de571d391ea7d76df2c8346f27a1ea7ba3c60357). Remaining reserve: 0.

Both runtime model traces select their requested feed, reference two cryptographically verified source observations, and match the registry and on-chain request, recipe and policy hashes. The verifier validates the recorded trace rather than calling the model again.

## Historical rejection verification

| Case | Historical decoded error | Receipt block | Transaction |
|---|---|---|---|
| edited-value | NotSignedByAirnode | 52479836 | [0xc1a66525…](https://sepolia.basescan.org/tx/0xc1a665252860449ee958a19df48f766bcc1fe5a7b200f8836ef5707c38ec3d53) |
| stale-real-response | ResponseTooOld | 52479847 | [0x47b6e1f8…](https://sepolia.basescan.org/tx/0x47b6e1f8107306d3ed992b4f7d754c4d74aa36f105d352076bf077152134d62a) |
| different-request | NotSignedByAirnode | 52479857 | [0xaaa02958…](https://sepolia.basescan.org/tx/0xaaa02958973f4cf9a19b19dc28247ab63d236d0e66f5b6f606d68ce4390b185e) |
| wrong-signer | NotSignedByAirnode | 52479869 | [0x471ef300…](https://sepolia.basescan.org/tx/0x471ef300ee8d7ac629e77d34f68f19519b28f2bf84ed18b0a79f3dd5d8542c05) |
| wrong-feed-ETH-into-BTC | NotSignedByAirnode | 52479880 | [0x8284dc80…](https://sepolia.basescan.org/tx/0x8284dc80b67a99352d1dd99c87a497c8d9b45d86549903209357518bf391fcb3) |

Every rejected transaction was decoded from actual chain input and replayed with eth_call at its receipt block. The market was still open, matched and inside its observation window, so the failure was not caused by a closed window or an already settled market. Protected reserve, policy, request, recipe, evidence and payout state matched before and after the reverted block and matched the recorded snapshots. Ethereum receipts do not themselves contain the custom error; the exact error is established by historical replay with unchanged protected state.

The edited case's signature authenticates the original data recovered from the wrong-key test input, with only its price changed in the edited input. The stale payload remains authentically signed. Both wrong-feed directions authenticate against the other registered request and fail against the target market's immutable request.

## Namespace and V1 preservation

- V1 and V2 role addresses are disjoint; all three V2 roles are distinct. Their deployed factory and collateral addresses differ.
- 17 original V1 source/config/test files match public tag `e8fb85c79eb8104f6530c77ecc50b6509672f59c` byte for byte. Existing V1 deployment and three original public evidence files match the captured SHA-256 baseline. Shared config/store/agent/executor and version-aware UI changes are intentional and are covered by the fresh V1 lifecycle.
- All 26 original V1 transaction hashes remain in the original journal; original markets 1, 2 retain their state, zero reserve, policy and evidence hashes. The V1 journal intentionally appends exactly one fresh regression job. Its settlement [0xa28020ba…](https://sepolia.basescan.org/tx/0xa28020ba9b708c402631074070c340e7fae0ffba920cbb91b9368dd061c90a0e) and payout [0xc98c0b40…](https://sepolia.basescan.org/tx/0xc98c0b4081516f9e1e3118f4e30014ea773cb9c2485f7b43360c84a906ea24fd) execute on the original V1 factory. New regression evidence is written under the V2 evidence directory; original public receipt files remain unchanged.
- Unsupported SOL goal rejection records 0 HTTP calls, unchanged job count and no submitted payment. Independent registry recognition confirms the rejected asset.

## Costs and limits

34 transaction fee records were reconciled to successful or reverted receipts, including actual L1 data fees. Recorded combined cost: **20144022020365 wei**. Rejected responses spend gas. Nodary latestFeeds is free; no x402 charge is claimed. Signed L2 gas limits and local conservative L1 reservations do not constitute an on-chain cap on the protocol-priced final L1 data fee.

Reproduce in the preserved local workspace after the live report is complete. The full journal-retention check requires `.local/next/v1-regression-baseline.json` and `.local/state.json`; these ignored history files are not supplied by a clean public clone. Published transaction hashes, inputs, historical error replays and the audit result remain public evidence.

```sh
npx tsx scripts/next-verify.ts
```

Primary evidence: [V2 chain smoke](evidence/v2/chain-smoke.json), [provider registry](evidence/v2/provider-registry.json), [V2 deployment](evidence/v2/deployment.json), and the frozen original evidence under `docs/evidence/`.


## Public reproduction

After installing dependencies and running `forge build`, a public clone can run `npx tsx scripts/next-verify.ts --public`. Keep the `v1-baseline` Git tag available. The command uses the sanitized public baseline manifest and published deployment/trace data, writes `docs/evidence/v2/verification-public.json`, and loads no wallet or private journal. Private journal membership, private state hashes and the private new-job append check are explicitly `not-run-public`; they are not presented as PASS. Historical chain actions, custom-error replays, receipt fees, role identities, immutable recipes/policies, original market state and frozen public artifacts are still verified. The preserved-workspace result remains in `verification.json` and is not overwritten.
