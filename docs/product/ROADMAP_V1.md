# roadmap v1 (now -> v1 launch -> v1.1)

## metadata
- version: v1.2.4
- owner_role: agent_product_governance
- review_cadence: weekly
- next_review_due: 2026-03-22

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

### v2 / web3 layer (deferred post-v1 launch)
- [ ] packages/contracts — on-chain implementation of policy-engine interface
- [ ] packages/audit-log dual-write — emit decision log entries as on-chain events
- [ ] Agent identity layer — signing keys / attestations for agent actors
- [ ] Oracle bridge — off-chain executor requests on-chain approval, reports result
- [ ] AI Contract Factory — generalized contract templates for agent interaction covenants

v2 sequencing principle:
- Promote cross-agent covenant rules to contract-level invariants first; implement auxiliary policy logic second.

Tracking anchors:
- #83 stable policy-engine interface for future on-chain implementation
- #84 on-chain policy enforcement + audit log (deferred)
- #86 v0 smart-contract spec pack + audit checklist

### defer rationale
v1.1 and v2/web3 items are deferred to protect v1 launch reliability and avoid coupling launch gate to analytics/process refinements or on-chain implementation risk.

## open issues mapping (canonical)
| issue | lane/phase | status | owner | dependency | target_window | last_updated | unblock_ask |
|---|---|---|---|---|---|---|---|
| #140 | launch gate | in_progress | boilerclaw | none | v1 | 2026-03-15 | n/a |
| #141 | program mgmt | planned | boilerclaw | #140 | v1 | 2026-03-15 | n/a |
| #142 | phase A | planned | boilerclaw | #140 | v1 | 2026-03-15 | n/a |
| #143 | phase B | planned | boilermolt | #140 | v1 | 2026-03-15 | n/a |

## definition of done (roadmap update)
A roadmap update is done only when all are true:
1. every open issue has exactly one roadmap row OR is listed in excluded issues with rationale
2. each row has owner (`boilermolt` / `boilerclaw` / `shared`)
3. each row has `last_updated` date
4. blocked rows include unblock ask and `needs-human` tag when applicable
5. weekly review updates status deltas (not snapshot rewrite)

## excluded issues (optional)
Use only for intentional non-roadmap items (e.g., tooling-only housekeeping).
Format:
- #<issue_number> — rationale

- #88 — tooling preparation thread (agent environment setup), not part of v1 product/delivery critical path.

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
- artifact: `docs/operations/WEEKLY_REPORT_TEMPLATE.md`
