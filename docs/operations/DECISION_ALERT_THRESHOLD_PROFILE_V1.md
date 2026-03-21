# decision alert threshold profile v1

## metadata
- version: v1.0.0
- owner_role: agent_product_governance
- review_cadence: weekly
- next_review_due: 2026-03-28

## objective
Define a machine-checkable threshold and operator-action profile for decision observability alerts so incidents map to deterministic next actions (`pause`, `investigate`, `retry`, `escalate`) instead of ad-hoc judgment.

## scope
This slice defines:
- canonical threshold profile shape
- default threshold values for v1 alert classes
- operator decision mapping for each alert class
- auto-remediation and fail-closed boundaries

This slice does **not** define:
- paging vendor integrations
- adaptive/statistical threshold tuning logic
- automatic execution bypasses

## dependencies
- alert semantics: `docs/operations/DECISION_ALERT_CONTRACT_V1.md`
- triage procedure: `docs/operations/DECISION_INCIDENT_TRIAGE_RUNBOOK_V1.md`
- canonical events: `docs/operations/DECISION_EVENT_SCHEMA_V1.md`
- metrics: `docs/operations/DECISION_METRIC_DICTIONARY_V1.md`

## profile artifact requirement
Thresholds and operator action mapping must be represented in a JSON artifact validated by:
- validator: `scripts/ops/validate_decision_alert_threshold_profile.py`
- sample artifact: `docs/operations/evidence/decision-observability/2026-03-21/decision_alert_threshold_profile_v1.json`

## alert-to-action matrix (v1 defaults)
| alert_name | default_severity | default_next_action | fail_closed_required | auto_remediation_allowed |
|---|---|---|---|---|
| `decision_stuck_age_breach` | `sev2` | `investigate` | yes | no |
| `validation_failures_repeating_by_lane` | `sev3` | `retry` | no | yes (bounded) |
| `hold_or_no_go_spike_vs_baseline` | `sev3` | `escalate` | yes | no |

Interpretation:
- `pause` means explicitly halt affected execution lane or scope
- `investigate` means run the first-10-min triage path before further state changes
- `retry` means bounded, idempotent retry of known-safe validation/remediation path
- `escalate` means open `needs-human` block with evidence and recommendation

## boundary rules
- no auto-remediation is allowed for `sev2` alerts
- any alert with `fail_closed_required=true` must preserve fail-closed posture until acknowledged
- retries must be bounded (`max_auto_retries`) and idempotent
- threshold/profile changes must be versioned and auditable

## v1 default threshold values
- `decision_stuck_age_breach.max_state_age_ms = 1800000` (30m)
- `validation_failures_repeating_by_lane.window_minutes = 15`
- `validation_failures_repeating_by_lane.count_threshold = 3`
- `hold_or_no_go_spike_vs_baseline.baseline_multiplier = 2`
- `hold_or_no_go_spike_vs_baseline.consecutive_windows = 2`

## integration notes
- alert contract defines semantic trigger classes; this profile defines concrete default values and action mapping
- runbook should consume `default_next_action` as the initial operator branch, then escalate/contain as evidence dictates
