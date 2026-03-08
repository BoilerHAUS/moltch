# moltch v1 product boundary

## metadata
- version: v1.0.1
- owner_role: agent_product_governance
- review_cadence: weekly
- next_review_due: 2026-03-15

## objective
Ship the first usable coordination cockpit with clear boundaries to avoid scope drift.

## target user (v1)
- small operator teams running multi-agent execution with human approvals.

## v1 must-have flows
1. **coordination view**: see thread stream and task context in one cockpit.
2. **issue-linked execution**: map active work to GitHub issues/PR status.
3. **governed action requests**: submit actions with approval state and audit outcome.
4. **ops signal**: basic health/readiness signal visibility for core services.

## three-pane definition (minimum)
Required panes:
- **threads pane**: list current active threads; selecting thread updates task context pane.
- **tasks pane**: show linked issue/PR status for selected thread.
- **treasury pane**: show proposal state (`submitted|under_review|approved|executed|failed`).

Minimum interactions:
- pane switch/select works without page reload
- selected thread ID is reflected in tasks pane context
- stale/empty states render explicitly in each pane

## v1 non-goals
- real-time multiplayer editing
- advanced analytics dashboarding
- onchain treasury execution
- custom plugin marketplace
- enterprise RBAC variants beyond core roles

## launch gate checklist (measurable)
- [ ] web shell supports three-pane minimum interactions above
- [ ] api baseline `/health` and `/ready` pass in staging for 24h with readiness success >= 99%
- [ ] governance docs published: `docs/governance/GOVERNANCE_V1.md` + `docs/governance/TREASURY_PROPOSAL_LIFECYCLE_V1.md`
- [ ] at least **2** end-to-end issue->PR->status reflection demos complete
- [ ] operations docs published: `docs/operations/RUNBOOK_V1.md` + `docs/operations/METRICS_V1.md`

## dependency links
- governance policy: `docs/governance/GOVERNANCE_V1.md`
- treasury lifecycle: `docs/governance/TREASURY_PROPOSAL_LIFECYCLE_V1.md`
- operations runbook: `docs/operations/RUNBOOK_V1.md`
- metrics schema: `docs/operations/METRICS_V1.md`
- staging deploy: `docs/operations/DEPLOY_STAGING.md`

## build sequence (prioritized)
1. repo + CI + baseline scaffolds (done)
2. cockpit shell + api baseline (done)
3. governance docs + treasury lifecycle docs (in progress)
4. issue/PR sync adapter (minimum read-only)
5. governed action request state display in UI
6. pilot loop with 1-2 real teams

## deferred to v1.1
- live websocket sync
- approval analytics and latency heatmaps
- advanced treasury policy automation

## v1.1 revisit trigger
Deferred items are reconsidered only after:
- two consecutive weekly reports meeting v1 KPI targets, and
- no critical governance or deployment blockers open.

## acceptance criteria
- doc provides clear in/out scope for planning and PR review.
- any requested feature can be categorized as v1 or deferred in <2 minutes.
