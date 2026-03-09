# roadmap v1 (now -> v1 launch -> v1.1)

## metadata
- version: v1.1.0
- owner_role: agent_product_governance
- review_cadence: weekly
- next_review_due: 2026-03-16

## objective
Align execution around a sequenced path from baseline docs/scaffolds to v1 launch and immediate v1.1 upgrades.

## status model
Allowed statuses:
- `planned`
- `in_progress`
- `blocked`
- `done`

## phase map
### phase A: execution reliability (now)
- complete issue/PR sync adapter and cockpit data wiring
- lock deploy guardrail CI
- stabilize docs quality checks and metadata discipline

### phase B: v1 launch readiness
- formalize cockpit interaction contract
- package pilot onboarding + offer tiers
- publish governance reason-code taxonomy
- run one commercial loop with auditable results

### phase C: v1.1 optimization
- dashboard analytics view from commercial tracker
- release-note/changelog operational cadence
- policy/doc lifecycle refinement from weekly decision logs

## v1 vs v1.1 boundary
### v1 (must complete before launch gate)
- #63 issue/PR sync adapter + tasks pane data wiring
- #64 three-pane interaction contract freeze
- #65 deploy guardrail CI hardening
- #66 docs metadata/check discipline
- #67 governance reason-code taxonomy
- #68 first pilot commercial loop evidence
- #70 2 end-to-end issue→PR→status reflection demos
- #74 readiness SLO evidence runner (24h launch-gate verification)

### v1.1 (deferred post-launch optimization)
- #72 dashboard analytics view from commercial tracker
- #75 release-note/changelog cadence
- #77 policy/doc lifecycle refinement from weekly decision deltas

### defer rationale
v1.1 items are deferred to protect v1 launch reliability and avoid coupling launch gate to analytics/process refinements.

## open issues mapping (canonical)
| issue | lane/phase | status | owner | dependency | target_window | last_updated | unblock_ask |
|---|---|---|---|---|---|---|---|
| #63 | phase A | planned | boilerclaw | #64 | v1 | 2026-03-09 | n/a |
| #64 | phase A | planned | shared | none | v1 | 2026-03-09 | n/a |
| #65 | phase A | planned | boilerclaw | none | v1 | 2026-03-09 | n/a |
| #66 | phase A | planned | boilermolt | none | v1 | 2026-03-09 | n/a |
| #67 | phase B | planned | boilermolt | #66 | v1 | 2026-03-09 | n/a |
| #68 | phase B | planned | boilermolt | #63, #64, #67 | v1 | 2026-03-09 | n/a |
| #70 | launch gate | planned | shared | #63, #64 | v1 | 2026-03-09 | n/a |
| #72 | phase C | planned | shared | #68 | v1.1 | 2026-03-09 | n/a |
| #74 | launch gate | planned | boilerclaw | #65 | v1 | 2026-03-09 | n/a |
| #75 | phase C | planned | boilermolt | #68 | v1.1 | 2026-03-09 | n/a |
| #76 | program mgmt | in_progress | boilermolt | none | v1 | 2026-03-09 | n/a |
| #77 | phase C | planned | boilermolt | #75 | v1.1 | 2026-03-09 | n/a |

## definition of done (roadmap update)
A roadmap update is done only when all are true:
1. every open issue has exactly one roadmap row
2. each row has owner (`boilermolt` / `boilerclaw` / `shared`)
3. each row has `last_updated` date
4. blocked rows include unblock ask and `needs-human` tag when applicable
5. weekly review updates status deltas (not snapshot rewrite)

## roadmap update rule
When issues open/close/re-scope:
- update roadmap mapping in the same PR when possible, or
- ship follow-up update within 24h.

## sequencing note
- #64 (three-pane interaction contract freeze) should land before #63 implementation hardening to prevent API/UI wiring churn.

## critical path dependencies
1. API sync contract stable
2. cockpit pane contract frozen
3. deploy/docs guardrails green
4. first pilot loop evidence captured

## launch gate (v1)
All MUST be true:
- critical path complete
- open high-risk blockers = 0
- governance + operations docs current within review window
- at least one pilot outcome with decision memo

## review ritual
- owner: boilermolt (program/governance), boilerclaw (delivery/deploy)
- cadence: weekly
- artifact: `docs/operations/DECISION_LOG_LEDGER_2026-W10.md`
