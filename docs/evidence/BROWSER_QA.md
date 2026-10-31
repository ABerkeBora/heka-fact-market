# Browser verification

Checked 2026-10-31 03:49–03:55 Europe/Berlin using the real ChatGPT in-app browser and this project's own localhost tab. Browser operations used the supported cua API. TasteSkill's external browser inspector was replaced by supported DOM inspection, screenshots and its source lint; no alternate browser automation driver was used.

- 1440×1000: composer, completed market resolution, contract policy, accepted source/signature timestamps, 2 FMCT payout and zero reserve visually checked. `ui-desktop.jpg`.
- 768×1024: compose/detail stack into one readable column. Main Draft action visible; no page overflow. `ui-tablet.jpg`.
- 390×844: first-screen question, stake, Draft action and snapshot visible; mobile menu opens/closes; document width equals viewport390. `ui-phone.jpg`.
- Geist loaded in browser (`document.fonts.check` true).
- UI triggered a real qwen3:4b proposal and one initial authorization for market2. Background worker funded both positions, settled and collected without additional payment clicks. Market2 completed after page reload.
- Evidence composer submitted `{}` and displayed a recoverable validation error. It did not display success or move market reserves. `ui-rejection.jpg`.
- History distinguishes initial loading from actual empty/zero state. Saved source data is labeled proposal snapshot, with saved/source/signature times.
- Four required live oracle tamper failures and actual buyer duplicate show their verified custom error names and explorer links.
- Private state and wallet URL probes returned404. No wallet key enters the browser response.

Temporary viewport overrides were reset. The application tab was retained as a deliverable.
