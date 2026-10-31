# Fact Market — presentation and submission draft

## 150-second presentation outline

- **0:00–0:15 — Problem.** A market question is easy to write; an immutable, verifiable resolution rule is harder. Fact Market lets an agent compose a bounded claim from an existing trusted data operation.
- **0:15–0:35 — Compose.** Enter an ETH/USD observation goal and stake. Show the actual local model call, allowed recipe and independent validation. The model chooses within the template, never oracle authority or transaction destinations.
- **0:35–0:55 — Authorize once.** Read the resolution card: threshold, strict comparator, source window and no-data refund. Show the fixed recipient/beneficiary, one-position FMCT cap and expiry. Authorize the agent; show actual buyer and counterparty funding receipts.
- **0:55–1:20 — Resolve and collect.** Open the recorded completed market. Show source time separately from signature time, accepted value, on-chain outcome, claim transaction and zero remaining reserve. Explain first accepted observation ordering risk in one sentence.
- **1:20–1:55 — Tamper pass/fail.** Show the four actual reverted transactions before the valid settlement on the same market: edited value, authentic old response, different request and wrong key. Display expected custom errors and unchanged reserve. Show duplicate intent rejection.
- **1:55–2:15 — Paid data.** Show two real PandaScore x402 receipts totaling 0.02 test aUSD and their delivered upcoming-match record. Say clearly that PandaScore discovery is verified, while the finished market template is Nodary. Free Nodary is not a paid API claim.
- **2:15–2:30 — Verify.** Show public repository, deployed Base Sepolia contract and judge response submission route. State inherited upstream trust and valueless test collateral. End with the working flow.

Actual recording/upload remains a team submission action; this document is an outline, not a video file.

## Devfolio project description draft

**Fact Market: bounded questions, fixed evidence, agent-funded positions.**

Agent developers and market creators need a practical way to turn an external-data question into a position whose settlement rule cannot be changed after funding. If the platform can substitute an answer, accept a response to another request, or replay an old value, collateral can go to the wrong party.

Fact Market uses a real local language model to select a bounded Nodary ETH/USD recipe from actual current source data. A deterministic validator fixes the threshold, source operation, exact parameters/projection, signer, observation window and refund policy. After one initial mandate, an isolated test-wallet executor registers capped on-chain authority, funds a test position, submits a qualifying signed observation and initiates the fixed beneficiary's payout. A separate opposing test role funds equal collateral.

AirnodeHub is essential: the deployed factory accepts the exact signed response bytes and checks the pinned Airnode signer, intended request, envelope freshness and upstream source time before selecting the payout side. The same market's live evidence includes four rejected tamper responses followed by a valid settlement. Mandate spend/action/expiry and intent uniqueness are enforced on chain; gas budgets and allowed tools are constrained by the local executor. This is an isolated test-wallet delegation, not a session-key platform.

Removing authenticated data prevents the core resolution. A forged price could otherwise select the wrong beneficiary, so neither the LLM nor a database flag may resolve a market. Signature authenticity does not independently establish upstream truth; the product inherits Nodary/provider trust and discloses that first accepted observations depend on keeper/transaction ordering.

Two additional real PandaScore purchases demonstrate bounded x402 discovery and delivered metadata, with confirmed Base Sepolia aUSD transfers. The complete implemented market is Nodary; the PandaScore final-result lifecycle remains future work. We wanted a fixed historical price round for exact-time settlement and a stable finalized match operation with explicit correction semantics; the verified available operations did not establish those stronger guarantees. We therefore narrowed the product's claim rather than implying historical precision.

All funds are valueless test assets on Base Sepolia. No mainnet funds, hosted deployment or competition submission was performed. BSV qualification is not claimed.

## Submission checklist

- Public repository and runnable README: see MORNING_HANDOFF.md for verified status.
- Contract/network and live evidence: docs/evidence/deployment.json and chain-smoke.json.
- Judge-controlled response: Evidence tab or documented script.
- Video <=2.5 minutes: PENDING recording/upload.
- Devfolio description/submission: draft ready; PENDING team action. One entry per team, up to three partner tracks.
- Published deadline checked in browser: 31 October 2026, 15:00 Europe/Berlin. Recheck recorded in TRACK_REQUIREMENTS.md.
