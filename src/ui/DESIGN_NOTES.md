# Fact Market interface direction

TasteSkill app-screen workflow applied. Dealt `achromatic-ledger`, seed `988226794`, with the brief's green palette retained. No redraw. The no-sidebar shell fits a product with two destinations and one main task. Geist is loaded; Geist Mono is reserved for identifiers and exact signed data.

The main screen asks: **What exact rule am I delegating the agent to fund?** The resolution card is the largest block and the signature element. It makes an IF/THEN observation rule visible, then replaces the empty rule with the actual model proposal and immutable policy. A small green price/predicate carries the data hue; actions and navigation remain ink.

## Data inventory

- Markets have a single ETH/USD predicate, threshold in USD with 18 on-chain decimals, close and observation timestamps in seconds.
- Collateral is valueless FMCT, with six decimals; source API fees and test ETH gas are separate.
- A position is 0.1–10 FMCT; the agent and separate opposing test role fund equal fixed stakes.
- Reserve and delivered payout derive from actual contract state and claim flags.
- Model proposals use live Nodary input. UI has no fixture proposals or fabricated balances.
- Each job has an initial mandate, persisted intent, stage, actual transactions and public events.
- Signer, exact request hash, full envelope and explorer transactions are accessible in details.
- The author reviews one resolution rule and a bounded mandate before initial delegation.
- Judges use the evidence form to submit exact envelope bytes; failed submissions remain visible as errors.
- The common job is drafting a bounded market, placed on the first screen.

## Layout and states

At 1440px, the centered 1200px canvas has two columns totaling 1176px plus a 24px gutter. Header, composition and recent markets share its left and right edges. At tablet widths up to 900px, the columns stack into a single working sequence so neither becomes narrower than 340px. Below 640px the same sequence uses 18px margins. Market rows become two-line rows, and evidence panels stack.

Empty, loading, model/API error, expired proposal, pending job, confirmation, rejected submission and recoverable job states are represented. A failed service poll preserves last displayed data; every state refresh is explicit and timestamped. No optimistic transaction success is shown.

Source lint: `node /Users/wargly/.codex/skills/design-taste-frontend/scripts/lint.mjs --app src/ui` passed with 0 FAIL and 0 WARN. Browser QA is owned by the parent implementation agent using the authorized `cua_repl` route; the standalone inspector's direct browser route is replaced accordingly.

No sample dataset requires replacement. The default prompt is editable product input, not an invented result.

Browser QA follow-up: parent inspected desktop, 768px tablet and 390px phone. No horizontal overflow observed. Tablet panels were too narrow, so composition and detail grids now stack at 900px. The source block explicitly identifies the observation as a proposal-time snapshot. Execution gas budget copy discloses conservative L1 reservation and possible protocol price variation. Phone evidence captured by parent at `docs/evidence/ui-phone.jpg`.

Main-card explanation is deterministic from validated side, threshold and observation policy. Raw model arithmetic is never used as an authoritative UI fact; any original model suggestion remains a separate trace owned by the backend.

## V2 route extension

The existing app identity and dealt style remain unchanged. `/` continues to call `/api`; `/next` calls only `/api/next`, with separate response data and the BTC-oriented default question. One small route link connects the two. V2 has no manual feed selector: the model chooses from the server's verified feed allowlist. The resolution card, snapshot unit, market titles and source details follow the actual returned feed. Immutable recipe/policy/request hashes and operation parameters/projection are inspectable before funding and in market details. No fixtures were added.
