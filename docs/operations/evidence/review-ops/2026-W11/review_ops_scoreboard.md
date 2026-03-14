# review-operations scoreboard — 2026-W11

- status: **complete**

## metric snapshot
| metric | current | prior | trend | SLO band |
|---|---:|---:|---|---|
| PR review latency (hours) | 14.2 | 18.6 | down | yellow |
| Blocker age >48h (count) | 1 | 3 | down | yellow |
| Handoff latency (hours) | 7.8 | 11.4 | down | green |
| Reopen rate (%) | 6.1 | 4.8 | up | yellow |

## top 3 bottlenecks
1. **Roadmap mapping misses on newly opened quality issues** — owner: `boilermolt` — due: `2026-03-18`
   - corrective_action: Add same-PR roadmap row update checklist in PR template.
2. **Review feedback turn-around bursts** — owner: `shared` — due: `2026-03-19`
   - corrective_action: Batch review windows twice daily with explicit ownership handoff.
3. **Contract hardening follow-ups split across issues** — owner: `boilermolt` — due: `2026-03-20`
   - corrective_action: Group #122/#123/#124/#127 into one execution board slice.

## action ledger
| action | owner | due_date | last_week_status | this_week_status |
|---|---|---|---|---|
| Enforce fail-closed docs checks on launch packet | boilermolt | 2026-03-14 | partial | done |
| Add soak hold-path dry-run artifact | boilermolt | 2026-03-14 | not_started | done |
| Define verdict-computation contract follow-up | boilermolt | 2026-03-20 | not_started | in_progress |
