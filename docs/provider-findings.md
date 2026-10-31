# PandaScore paid-call and conditional BSV findings

Checked **31 October 2026, 03:40–03:43 Europe/Berlin**. This is integration evidence for paid provider discovery, **not a completed PandaScore market lifecycle**. The primary implemented market template remains Nodary.

## Verified provider metadata

Official live metadata: <https://airnode-pandascore.fly.dev/>. Airnode signer: `0xd9D29FEDc3737aD5198611457fE04aB08a739C7b`.

Both `matchesUpcoming` and `getMatch` are priced at `10000` six-decimal aUSD units per call (0.01 test aUSD). Discovery therefore also costs a call. Metadata alone does not expose a current match ID.

The real x402 v2 challenge was inspected before paying:

| Field | Pinned value |
|---|---|
| Resource | `https://airnode-pandascore.fly.dev/` |
| Scheme / network | `exact` / `eip155:84532` |
| Asset | `0xbeA34973e5f67F18F656A2C6070C64326C791808` |
| Recipient | `0x1505FD562AC2Fb4307B85BC6c672FfeafB4d57A7` |
| Per-call amount cap | `10000` |
| Total amount cap / max calls | `30000` / `3` |
| Maximum authorization timeout | 300 seconds |
| Asset domain | AirnodeHub USD, version 1 |
| Payer | isolated Fact Market deployer `0x3e9fba4E2C664557BB42A357257f1a086E65B09e` |
| Mandate expiry | `2026-10-31T03:11:11.916Z` (04:11 Berlin) |

The facilitator submits the token transfer; the payer's gas cap for these x402 calls is zero. The aUSD fee is separate from market collateral and is already spent once the transfer settles. Later inability to settle a market does not reverse this data fee.

## Two real paid results

Both x402 settlements were confirmed via Base Sepolia RPC, including the exact aUSD Transfer log from the mandate payer to the pinned recipient for 10000 units each. Both response signatures recovered the pinned Airnode signer. The exact operation/parameters/projection request hashes were independently derived using the official starter's canonical entry ordering, and the signed `data` bytes were not reserialized for signature verification.

| Call | Exact request hash | Confirmed transaction |
|---|---|---|
| `matchesUpcoming`, `per_page: 1`, projected first match | `0x3d0e6c8d5bde3059640dc280b20c712aecf88393e4be6172ceca9e4f9dc1fc2e` | [Discovery payment](https://sepolia.basescan.org/tx/0xe95f2ac7498a1dce74004f66a5997dbcd9c32936721e731d77d0de31e15c4ead), block 52463023 |
| `getMatch`, `match_id_or_slug: "1643083"`, projected identity/finality/opponents | `0x159dcbe5c5738d59ee0bd55b83dda20195af7088b44d71f90834a6e548aaf409` | [Match metadata payment](https://sepolia.basescan.org/tx/0xe209b8ef317235d947e84d66f8ee545c5d603ef583eaf2392725a9201cf2e9cb), block 52463027 |

Actual delivered record at 03:41 Berlin:

- Match `1643083`, “Grand final: ANK Gaming vs DCG”.
- Scheduled `2026-10-31T02:45:00Z` (03:45 Berlin); `status: not_started` at discovery.
- Opponent IDs: `135988` ANK Gaming and `133856` Deep Cross Gaming.
- `winnerId: null`, `endedAt: null`, `draw: false`, `forfeit: false`.
- Source `modifiedAt: 2026-10-31T02:33:53Z`. Discovery was signed at `02:41:12Z` and received at `02:41:13.498Z`; getMatch was signed at `02:41:13Z` and received at `02:41:14.365Z`. The upstream update time is therefore separately recorded and is older than the fresh envelopes.

Total charged: **20000 aUSD units (0.02 test aUSD)**. No final result call was made and no PandaScore market was funded or settled by this smoke. A future match's initial metadata must not be used as its final result. `winnerId` and `endedAt` are nullable; metadata lists statuses `canceled`, `finished`, `not_started`, `postponed`, and `running`. Any later PandaScore market must pin both opponent IDs and its immutable finality/void policy before exposure.

## Reproduction and payment retry boundary

```sh
npx tsx scripts/provider-smoke.ts        # Metadata and real 402 challenge only; no payment
npx tsx scripts/provider-smoke.ts --pay  # At most two paid calls within fixed mandate
```

The paid path loads `.env` and reads only the deployer role from `FACT_MARKET_WALLETS`, then `WALLET_FILE`, or `.local/test-wallets.json`. It checks private file permissions, key/address agreement, `testOnly: true`, chain ID 84532 and the RPC chain ID. No keys go to the model or output.

Before signing, `.local/panda-intent.json` reserves the fee against the total mandate. Before sending, it persists the exact signed EIP-3009 authorization header, nonce and a submitted marker at mode `0600`. It sends the signed request once with native fetch; it does not use the SDK wrapper's recovery branch, which can create a fresh payment payload. Any unresolved existing intent stops for reconciliation. The signed authorization is private and never belongs in public evidence.

Re-running the completed smoke reused the two delivered results: journal intent count remained **2**, settled amount remained **20000**, and transaction hashes were unchanged. No third authorization or charge was created. This replay check establishes this script's idempotency behavior; it is not evidence that an arbitrary provider implements idempotent HTTP responses.

Private local journal: `.local/panda-intent.json`. Public-safe signed response/receipt report: `.local/panda-report.json` (parent may publish a sanitized copy; it contains no keys or payment authorization headers). The `.local` directory remains ignored. Completed replay uses each cached result's original receipt time when checking whether its initial record was future; it does not reinterpret that cached record as a newly discovered upcoming match.

If a process fails after submission but before a receipt is recorded, do not create another authorization. Use the persisted EIP-3009 nonce/validity and token authorization state plus matching transfer logs/receipt to reconcile. If a payment succeeded but the result was lost, that fee may be spent without a delivered result; the tool must surface that state rather than promise a free retry.

## BSV conditional gate: unresolved, excluded

Read-only inspection of the supplied official `START-HERE.md`, `AGENTS.md` and relevant `BSV_STACK_COMPLETE_GUIDE.md` sections found the standard-wallet BRC-100 flow and pinned versions (`@bsv/sdk` 3.2.1, `@bsv/wallet-toolbox` 2.14.9). The supplied starter tests are mock-chain tests; they do not establish a real Fact Market transaction. The quickstart's funded standard-wallet path is mainnet and requires obtaining satoshis through the sponsor; no third-party message or mainnet spend was authorized or performed here. The guide separately lists testnet Arcade infrastructure.

No native API3 EIP-191/Keccak verification implementation for BSV was established by this inspection. This is an unresolved gate, not a claim that none exists anywhere. A relay that verifies on EVM and signs a new BSV message would add a relay trust assumption and would not establish native API3 verification. No standard-wallet transaction, useful BSV DeFi core, or BSV agent payment was demonstrated. **Do not claim BSV qualification.** Continue the primary API3 flow.

Official references:

- <https://github.com/api3dao/airnodehub-hackathon-starter/tree/52933ae1fb9371446a927338473466c3d320e19a>
- <https://api3dao.github.io/airnodehub-hackathon/docs/from-api-to-contract>
- <https://api3dao.github.io/airnodehub-hackathon/docs/integrations>
- <https://github.com/bsv-blockchain/ts-stack>
- <https://bsv-blockchain.github.io/ts-stack/>
- <https://hackathon.tum-blockchain.com/prizes#bsv-association>

## Local transaction executor hardening

`server/transactions.ts` serializes every operation by signing role, including app worker and judge routes. A new signature requires reconciliation of the role's other journal entries and no unknown pending account nonce. An existing signed raw transaction is reconciled by its exact hash and may be rebroadcast without creating a fresh signature. New signatures stop at the pinned mandate expiry; permissionless contract claim/refund paths remain available separately if the local mandate has expired.

Before a new signature, the central validator checks chain, fixed role addresses, token, market, role-specific function allowlist, and exact approval/mandate/funding/policy/claim bindings. Pending transactions reserve their maximum estimated fee; confirmed and reverted transactions both contribute real spent gas. Receipts include the Base L1 data fee separately from L2 execution gas. Missing L1 fee data retains a conservative reservation and is marked partial rather than reported as zero.

The signed EIP-1559 transaction caps L2 gas units and maximum L2 gas price. The OP L1 data fee is protocol-priced and cannot be hard-capped by those fields. The local executor reserves twice its L1 estimate plus a small fixed margin, records the actual L1 receipt fee, and stops further actions when the resulting budget is exhausted. The local all-in gas budget is therefore an execution check with a conservative L1 reservation, not an on-chain guarantee of the final L1 charge.

Six unit checks passed in `server/transactions.test.ts`: pending/paid/reverted budget accounting, legacy/partial-fee reservations, L1 fee accounting, per-role serialization and failure release, pinned recipient/approval/tool constraints, and cross-market/funding intent rejection.
