# decision alert contract v1

## metadata
- version: v1.0.0
- owner_role: agent_technical_delivery
- review_cadence: weekly
- next_review_due: 2026-03-28

## objective
Define the minimum alerting contract for decision observability so stuck, failing, or abnormal decision flows produce deterministic operator-visible signals with clear severity and ownership.

## scope
This slice defines:
- alert names and trigger conditions
- minimum severity levels
- ownership expectations
- required event/metric inputs
- deduplication and escalation expectations

This slice does **not** define:
- pager vendor integration
- notification transport wiring
- exact threshold tuning beyond baseline defaults

## dependencies
- canonical events: `docs/operations/DECISION_EVENT_SCHEMA_V1.md`
- metric definitions: `docs/operations/DECISION_METRIC_DICTIONARY_V1.md`
- incident procedure: `docs/operations/DECISION_INCIDENT_TRIAGE_RUNBOOK_V1.md`

## severity model
- `sev2`: governance-significant failure requiring prompt operator attention
- `sev3`: degraded observability or repeated policy/validation failure requiring same-day intervention
- `sev4`: informative warning for emerging drift or threshold pressure

## alert contract table
| alert_name | trigger | default severity | ownership | minimum signal inputs |
|---|---|---|---|---|
| `decision_stuck_age_breach` | a non-terminal decision exceeds configured max age in one state | `sev2` | `agent_technical_delivery` | `decision_id`, `correlation_id`, `from_state`, `emitted_at_utc`, age calculation |
| `validation_failures_repeating_by_lane` | repeated `validation_failed` / `artifact_missing` / `evidence_missing` events above threshold in one lane/window | `sev3` | `agent_technical_delivery` | `lane`, `reason_code`, rolling count/window |
| `hold_or_no_go_spike_vs_baseline` | `hold_rate` or `no_go` share breaches baseline band for configured windows | `sev3` | `agent_product_governance` | `lane`, `result`, baseline window comparison |

## baseline threshold defaults
### decision_stuck_age_breach
- default condition: any decision remains in the same non-terminal state longer than `30m`
- minimum dimensions in alert payload:
  - `decision_id`
  - `correlation_id`
  - `lane`
  - `current_state`
  - `age_ms`
  - `last_reason_code`

### validation_failures_repeating_by_lane
- default condition: >= `3` matching failure events in `15m` within the same lane
- matching reason codes:
  - `validation_failed`
  - `artifact_missing`
  - `evidence_missing`
- minimum dimensions:
  - `lane`
  - `reason_code`
  - `count_in_window`
  - `affected_decision_count`

### hold_or_no_go_spike_vs_baseline
- default condition: `hold_rate` or `no_go` result share exceeds baseline by `2x` across `2` consecutive windows
- minimum dimensions:
  - `lane`
  - `result`
  - `current_window_value`
  - `baseline_value`
  - `window_size`

## contract rules
- alerts must be reconstructible from canonical events + metric definitions
- alerts must key to stable ids (`decision_id` and/or `correlation_id`) where available
- duplicate alerts for the same root condition should collapse within the active incident window
- every fired alert must have a named owner role
- every sev2/sev3 alert must point to the incident triage runbook
- if input parity is incomplete, the system should fail closed on execution-critical flows and emit an observability gap record rather than silently suppressing the alert

## routing expectations
- `sev2`: immediate operator-visible routing, governance visibility required
- `sev3`: same-day routing to owning lane
- `sev4`: summary/reporting path acceptable unless recurring

## alert payload minimum shape
```json
{
  "alert_version": "decision_alert_contract.v1",
  "alert_name": "decision_stuck_age_breach",
  "severity": "sev2",
  "fired_at_utc": "2026-03-21T00:00:00Z",
  "owner_role": "agent_technical_delivery",
  "decision_id": "dec_01H...",
  "correlation_id": "corr_01H...",
  "lane": "core",
  "summary": "decision exceeded stuck-age threshold in under_review",
  "runbook_ref": "docs/operations/DECISION_INCIDENT_TRIAGE_RUNBOOK_V1.md"
}
```

## invalid alert conditions
- alert without owner role
- alert without stable reference to underlying decision/workflow where available
- alert that cannot be derived from canonical events/metrics
- alert that omits runbook reference for `sev2`/`sev3`

## integration notes
- threshold tuning can change in later slices without replacing the underlying contract shape
- dashboards may visualize these alerts, but dashboards are not the source of truth for alert semantics
