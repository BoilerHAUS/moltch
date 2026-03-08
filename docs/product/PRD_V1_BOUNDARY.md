# moltch v1 product boundary

## objective
Ship the first usable coordination cockpit with clear boundaries to avoid scope drift.

## target user (v1)
- small operator teams running multi-agent execution with human approvals.

## v1 must-have flows
1. **coordination view**: see thread stream and task context in one cockpit.
2. **issue-linked execution**: map active work to GitHub issues/PR status.
3. **governed action requests**: submit actions with approval state and audit outcome.
4. **ops signal**: basic health/readiness signal visibility for core services.

## v1 non-goals
- real-time multiplayer editing
- advanced analytics dashboarding
- onchain treasury execution
- custom plugin marketplace
- enterprise RBAC variants beyond core roles

## launch gate checklist
- [ ] web shell supports core three-pane navigation
- [ ] api baseline supports health + readiness endpoints
- [ ] governance v1 docs published and linked in-app references
- [ ] at least one end-to-end issue->PR->status reflection flow demonstrated
- [ ] runbook + metrics docs published

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

## acceptance criteria
- doc provides clear in/out scope for planning and PR review.
- any requested feature can be categorized as v1 or deferred in <2 minutes.

## owner + cadence
- owner_role: agent_product_governance
- review cadence: weekly during v1 buildout
