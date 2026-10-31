# Native prediction screen

TasteSkill app-screen direction: retain Fact Market's restrained off-white/forest-green editorial workspace, not a second marketing identity. The screen answers: **What exact source rule controls these two stakes, and what can the agent do next?**

- Objects: one immutable ETH/USD policy, two1000sat positions, original source envelope, one canonical funding intent and one final spend.
- Amounts: native test sats only; historical committed amounts differ from currently protected unspent collateral.
- People: a user reviewing an initial mandate, then a keeper/judge inspecting source and output evidence.
- Jobs: propose a bounded rule, prepare the initial mandate, reconcile the same funding hash, inspect a result or check an original envelope.
- First block: question, real status, source/window/amounts and the available action.
- Side block: limits, oracle cost0, exact sponsor fee, principal controls and timing/source assumptions.
- Payment trail: real recorded events and transaction links; no fixture successes or invented balances.
- Failure handling: network-received is pending; bad source cannot change protected outputs; read-only checker never signs or broadcasts.
- Responsive QA: actual Chrome desktop,820px tablet and390px phone; screenshots in `docs/evidence/bsv/screenshots/`.
- The native source consumer is a separate route; V1/V2 snapshots verify the original workflows remain accessible.

## Native presentation completion

The `/bsv/fast` screen keeps the existing off-white ground, forest-green value emphasis, inherited type, flat ruled panels and paired-stake strip. No new visual system or style draw was introduced: preserving the existing product identity is an explicit user constraint.

- One question leads: **What exact rule controls the pool, and what can happen next?** The actual market status and server-selected next action appear before the stake totals.
- The payment engine supplies `nextAction`, `canPropose`, `walletGate`, `chainTime` and `presentation`. The UI does not infer recovery authority from browser time or re-enable a refund by guessing mandate rules.
- Funding and historical committed shares are separate from currently protected collateral. A paid or refunded market has a zero protected pool. The displayed stake shares and total derive from the same immutable policy amounts.
- Wallet synchronization, pending publication, waiting for a source observation, waiting for chain median time, node rejection and terminal payment are distinct states. A signed transaction is not displayed as a completed payment.
- The primary action is the single available server action. A new proposal is available only when `canPropose` confirms safe rollover; prior policies and transaction history remain preserved by the engine.
- The API3 version stays directly available. Earlier versions move into a quiet disclosure, preserving all routes without competing with the current workflow.
- The first accepted qualifying observation sets the result. A matured refund and a valid outcome spend can compete for the same UTXO; there is no exact-second/current-clock guarantee or upstream-truth guarantee.
- The response checker remains read-only. Captured eligible observations and initial reference responses are labelled differently; an initial response can correctly fail the later observation window. Checker errors stay local, and results reset when the active policy changes.
- Loading does not invent zero transaction history. Failed refreshes keep the last good values, display their load time and disable new actions until state can be refreshed.

Static check: `npx tsc --noEmit` passed after these UI edits. Real-browser desktop/tablet/phone inspection and final screenshot verification remain the coordinator's delivery checks; they are not claimed complete here.
