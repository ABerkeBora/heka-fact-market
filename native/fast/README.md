# NodaryFastAsm: new native BSV outcome template

**Local compiled VM and SDK interoperability PASS; no network funding/payout by this spike.** This is a new experimental immutable contract. Existing funded NodaryOutcome UTXOs cannot use it. Preserve old helpers, policy hashes, funding/claim/refund history and template identifiers. Create a separately identified new pool only through the coordinator's test-funding flow.

Original Airnode EIP-191 authentication is native: Script hashes the exact UTF-8 body with pinned request hash and uint256 signing timestamp, then EIP-191 prefix. Native byte-lane Keccak uses the independently vector-tested `KeccakAsm.digestOneBlock` library. Jacobian ECDSA verifies against the pinned original full source key. It accepts two untrusted arithmetic hints and **checks both**: `s*sInverse % n == 1`, and the slope identity deriving `G+Q` from the pinned Q. The ladder uses projective coordinates and verifies the final x coordinate modulo n without an inverse. No backend digest, attestor key or model decision is a settlement authority.

The unchanged consumer rules parse the original signed positive decimal `price` and 13-digit millisecond `updatedAt`, enforce immutable source/signature observation intervals and lag, apply `price > threshold` (equality means NO), and bind the full paired collateral to an immutable winner script. Refund binds actual transaction preimage, non-final sequence, nLockTime and the exact original stake split. An optional separately signed fee input may contribute one change output; protected collateral cannot be reduced for fees.

**Measured fixture:** locking 1,017,821 bytes, **281,400 non-push opcodes**, post-code-separator subscript 1,131 bytes, SDK preimage 1,290 bytes, unlocking 1,500 bytes with fee change. Published Teranode default maxopsperscriptpolicy is1,000,000; being below it is a local estimate, not a node acceptance claim. Approximate minimum funding fee at1sat/KB is1,019sat plus collateral; obtain the actual wallet/node quote. Previous 5MB template's real claim was rejected by public nodes for operation/time policy; do not relabel that old claim successful.

Runtime dependencies are pinned in package.json/lockfile: SDK3.2.1, scryptlib2.2.6, viem2.38.5. The helper loads `artifacts/nodary-fast-asm.json.gz` directly (or plain JSON if present), with no workspace imports.

```js
const {createNodaryFastAsm, verifyRaw} = require('./consumer-fast-asm.cjs')
const guard = createNodaryFastAsm(publicImmutablePolicy)
```

Policy field names match the original paired consumer: `requestHash, airnodePublicKey, expectedAirnodeAddress, validFrom, validTo, threshold18, collateralSatoshis, yesRecipientScript, noRecipientScript, refundAfter, refundBuyerScript, refundCounterpartyScript, buyerStakeSatoshis`. All amounts/times are integers. Use actual distinct wallet-derived P2PKH recipients and official source/request constants verified before funding. `airnodePublicKey` is full uncompressed hex; the helper maps it independently to `expectedAirnodeAddress`.

The returned object has `lockingHex`, `postSeparatorScriptHex`, `info`, `unlock`, `_delegate`. Construct actual outputs and fee inputs first, then use SDK `TransactionSignature.format` with actual outpoint/value/index/other inputs/outputs/sequence/lockTime, **scope ALL|FORKID (0x41)** and **postSeparatorScriptHex**, not the full locking Script. Call `guard.unlock({refund, envelope, preimageHex, changeAmount, changePublicKeyHash})`; public arithmetic hints are generated automatically. Internal spend ABI is `(refund,timestamp,data,{r,s},sInverse,jointLambda,preimage,changeAmount,changeAddress)`. Old unlocking ABI is incompatible.

`verifyRaw({policy,rawTransaction,inputIndex:0,sourceSatoshis})` runs the actual existing input unlocking bytes in the compiled local VM, verifies canonical raw/context and checks source amount against immutable collateral. It does not simulate a public node's resource policy or prove that an outpoint exists; reconcile the actual journaled funding transaction separately.

Reproduce local tests from this folder:

```sh
npm ci --ignore-scripts
node test-fast-asm.cjs
node test-fast-sdk-asm.cjs
```

These are the two supported standalone replay tests. They load the pinned
compressed artifact directly and do not require a compiler or TypeScript
contract build. The generated dummy raw transaction and policy are test outputs;
keep them out of source publication and never broadcast them.

`src/contracts/*.ts` and `bundle-manual.cjs` are retained research/provenance
sources, not application or test entrypoints. The TypeScript sketches use
`scrypt-ts`, which is intentionally outside this runtime package. The manual
packaging script additionally needs the separately obtained compiler at
`../compiler/scryptc/mac/scryptc` and its generated AST/hex build files. Archived
curve-edge result records describe the original independent research checks;
their separate test artifact is not included in this replay package. None of
these research files is required by the helper or the two commands above.

Twelve compiled tests cover YES/NO, redirected/reduced payout, edited data, wrong inverse/slope witnesses, wrong request, stale interval, early refund, all-final-sequence refund and mature paired refund. SDK test additionally checks exact serialized two-input transaction, fee change and scope0x41. Fixtures are already-observed genuine public data and dummy UTXOs/recipient hashes11/22/33. **Never broadcast these fixture scripts.** A live prediction must fund a new future eligible observation window before consuming its later response.

Timing remains explicit: fixed signed/source observation window, no trusted current-block timestamp, no EVM-style wall-clock settlement expiry. A valid observation can settle later; after refund maturity, the first valid settlement/refund UTXO spend wins. Source authentication does not prove upstream truth. New curve/Keccak composition is unaudited, and this bounded parser is not general JSON/arbitrary APIs.

Source and artifact hashes are in PROVENANCE.json. Direct manual sCrypt composition imports unchanged parser and tested new curve/hash libraries; no TypeScript transformation success was fabricated for that manual composition. Compiler1.22.0+commit.47800da, unoptimized flags `compile --hex --ast -r`. Compiler URL: https://github.com/sCrypt-Inc/compiler_dist/releases/download/v1.22.0/scryptc-1.22.0-macOS-x86_64 . Curve formulas: https://www.hyperelliptic.org/EFD/g1p/auto-shortw-jacobian-0.html . Published resource-policy source: https://github.com/bsv-blockchain/teranode/blob/main/settings/policy_settings.go .
