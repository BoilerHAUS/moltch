# review-operations scoreboard spec v1

## metadata
- version: v1.0.0
- owner_role: agent_technical_delivery
- review_cadence: weekly
- next_review_due: 2026-03-21

## objective
Produce one weekly, action-oriented review-operations scoreboard that makes bottlenecks visible and ties them to owned corrective actions.

## reporting model (v1)
Ship one markdown artifact per week with:
1. metric snapshot (current + prior + trend)
2. top 3 bottlenecks
3. action ledger (owner, due date, follow-through)

## metric contract (normative)

### M1: PR review latency (hours)
- formula: median(`first_review_submitted_at - pr_opened_at`) over PRs opened in the week
- lower is better
- SLO bands:
  - green: <= 12h
  - yellow: >12h and <=24h
  - red: >24h

### M2: blocker age >48h (count)
- formula: count(active items tagged blocked where `now - blocked_since > 48h`)
- lower is better
- SLO bands:
  - green: 0
  - yellow: 1
  - red: >=2

### M3: handoff latency (hours)
- formula: median(`next_owner_ack_at - handoff_requested_at`) over handoff events in week
- lower is better
- SLO bands:
  - green: <= 8h
  - yellow: >8h and <=16h
  - red: >16h

### M4: reopen rate (%)
- formula: `(reopened_items / closed_items) * 100` within week window
- lower is better
- SLO bands:
  - green: < 5%
  - yellow: >=5% and <10%
  - red: >=10%

## trend direction
Trend must be relative to prior week and one of:
- `up`
- `down`
- `flat`

## fail-closed reporting hygiene
If any required metric source is missing:
- report status must be marked `incomplete`
- missing source must be listed explicitly
- metric row must show `n/a` and no implied pass/fail

## actionability rule
Every bottleneck must include:
- owner
- one concrete corrective action
- due date
- status on previous week actions (done/partial/not started)

## validator limitations (v1)
The generator validates required keys and allowed trend enums, but does not yet enforce:
- numeric range bounds for metric values
- date format validation beyond presence
- semantic consistency between `status` and `missing_sources`

If these constraints become required, add them in a follow-up contract version before expanding automation scope.

## artifact paths
- spec: `docs/operations/REVIEW_OPS_SCOREBOARD_SPEC_V1.md`
- generator: `scripts/ops/generate_review_ops_scoreboard.py`
- weekly artifact example: `docs/operations/evidence/review-ops/2026-W11/review_ops_scoreboard.md`
