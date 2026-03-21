# decision event schema v1

## metadata
- version: v1.0.0
- owner_role: agent_technical_delivery
- review_cadence: weekly
- next_review_due: 2026-03-28

## objective
Define a single canonical transition event contract for decision observability so metrics, alerts, dashboards, and incident triage are reconstructed from one authoritative event stream.

## scope
This slice defines:
- required event fields and constraints
- reason/result normalization rules
- idempotency and ordering expectations
- minimum emission coverage for decision transitions
- fixture examples for valid/invalid events

This slice does **not** define:
- transport/storage implementation
- dashboard implementation details
- alert threshold tuning

## canonical event
Every decision transition emits one event:

```json
{
  "event_id": "evt_01H...",
  "event_version": "decision_event.v1",
  "emitted_at_utc": "2026-03-21T00:00:00Z",
  "correlation_id": "corr_01H...",
  "decision_id": "dec_01H...",
  "from_state": "under_review",
  "to_state": "approved",
  "reason_code": "approval_quorum_satisfied",
  "actor_role": "governance_reviewer",
  "lane": "core",
  "result": "success",
  "latency_ms": 8423
}
```

## required fields
- `event_id` (string, globally unique)
- `event_version` (must equal `decision_event.v1`)
- `emitted_at_utc` (ISO-8601 UTC)
- `correlation_id` (string, ties related events/workflow)
- `decision_id` (string, stable id of decision object)
- `from_state` (string)
- `to_state` (string)
- `reason_code` (string, normalized taxonomy)
- `actor_role` (string)
- `lane` (string; e.g., `core`, `web3`, `launch-gate`)
- `result` (`success` | `hold` | `no_go` | `error`)
- `latency_ms` (integer >= 0; elapsed time since prior transition boundary)

## normalization rules
- one transition -> one event; never batch multiple transitions into one event
- `decision_id` must remain stable across the lifecycle
- `correlation_id` must remain stable for all events in the same workflow chain
- `from_state` and `to_state` must not be equal
- `reason_code` must be machine-parseable snake_case
- `latency_ms` must be deterministic from boundary timestamps

## reason code baseline (v1)
- `admissibility_passed`
- `admissibility_failed`
- `approval_quorum_satisfied`
- `approval_quorum_insufficient`
- `policy_check_passed`
- `policy_check_failed`
- `artifact_missing`
- `evidence_missing`
- `validation_failed`
- `stuck_timeout`
- `manual_override`

## lifecycle coverage requirement
At minimum, emit events for:
- `draft -> proposed`
- `proposed -> under_review`
- `under_review -> approved | rejected | expired | cancelled`
- `approved -> executed | paused_blocked | expired | cancelled`
- `paused_blocked -> approved | expired | cancelled`

If a terminal state is reached without an event, observability is non-conformant.

## idempotency and replay
- producers should guarantee at-least-once emission
- consumers should deduplicate by `event_id`
- replayed events must preserve original `event_id`, `emitted_at_utc`, and payload

## invalid conditions (must reject)
- missing required field
- unknown `event_version`
- negative `latency_ms`
- non-UTC or malformed timestamp
- `from_state == to_state`
- unknown `result`

## integration notes
- Metric definitions consume this schema (see `DECISION_METRIC_DICTIONARY_V1.md`).
- Alert contracts and runbooks should key off `reason_code`, `result`, and state transition patterns.
