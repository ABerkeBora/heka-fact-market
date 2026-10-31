# Fact Market V1 baseline

- Working V1 commit: `e8fb85c79eb8104f6530c77ecc50b6509672f59c` on `codex/build`.
- Frozen tag: `v1-baseline` (must never be moved).
- Route: http://localhost:3102/ ; API `/api/*`.
- Start: `npm ci`, `forge build`, `npm run build`, `npm start`; local development `npm run dev`.
- Base Sepolia factory: `0xfbacf475b8a6729d97db83a06b07ff303a243614`.
- V1 FMCT: `0x4d317922ad3a235718ef1c5c4c71c85094df880a`.
- V1 local deployment/journal: `.local/deployment.json`, `.local/state.json`. Existing wallet file is selected by ignored `.env` `WALLET_FILE`; never copied into V2/public source.
- V1 receipts/evidence: `docs/evidence/deployment.json`, `agent-runs.json`, `chain-smoke.json`, `restart-reconciliation.json`, browser screenshots. Two completed ETH/USD markets, valid settlement/claim, all four required oracle tamper failures and buyer duplicate proof preserved.
- V1 public delivery: https://github.com/ABerkeBora/heka-fact-market/tree/v1-baseline .
- Original real Goal was marked `complete` by update_goal in the V1 conversation. At V2 dispatch, get_goal returned `goal: null` (no active Goal); no unfinished Goal was marked complete to start V2.

V2 may share unchanged UI/executor utilities but uses `/next`, `/api/next/*`, separate local state/intents, independent roles and separate deployment/collateral. It must not consume or overwrite V1 jobs or historical evidence. V1 regression is part of V2 acceptance.
