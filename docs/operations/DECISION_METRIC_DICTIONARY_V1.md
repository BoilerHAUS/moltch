# decision metric dictionary v1

## metadata
- version: v1.0.0
- owner_role: agent_product_governance
- review_cadence: weekly
- next_review_due: 2026-03-28

## objective
Standardize metric definitions for decision observability so reporting and alerting cannot drift across implementations.

## dependencies
- canonical events: `docs/operations/DECISION_EVENT_SCHEMA_V1.md`

## metric template (required)
For each metric define:
- metric_name
- intent
- numerator
- denominator
- formula
- unit
- aggregation windows
- dimensions
- exclusions
- alert hooks

## v1 metric definitions

### 1) decision_latency_ms
- intent: measure speed from decision request to terminal verdict
- numerator: sum of terminal lifecycle durations (ms)
- denominator: count of decisions reaching terminal state
- formula: `sum(latency_ms_to_terminal) / count(terminal_decisions)`
- unit: milliseconds
- reporting: p50, p95
- windows: 1h, 24h, 7d
- dimensions: lane, actor_role, result
- exclusions: cancelled-by-requester before review start
- alert hooks: p95 exceeds configured threshold for 2 consecutive windows

### 2) hold_rate
- intent: monitor fraction of decisions ending in hold-equivalent outcomes
- numerator: count(decisions with result=`hold`)
- denominator: count(all terminal decisions)
- formula: `hold_count / terminal_count`
- unit: ratio (0..1) and percent
- windows: 24h, 7d
- dimensions: lane, reason_code
- exclusions: none
- alert hooks: hold rate spike beyond baseline band

### 3) missing_artifact_catch_rate
- intent: measure pre-execution catches of missing schema/evidence artifacts
- numerator: count(transitions with reason_code in [`artifact_missing`,`evidence_missing`])
- denominator: count(all admissibility/validation checks)
- formula: `missing_artifact_catches / admissibility_checks`
- unit: ratio (0..1) and percent
- windows: 24h, 7d
- dimensions: lane, artifact_type
- exclusions: synthetic tests unless explicitly tagged include_in_prod_metrics=true
- alert hooks: repeated misses above threshold by lane

### 4) retry_rate
- intent: quantify rework pressure in decision flow
- numerator: count(decisions with attempts > 1)
- denominator: count(all terminal decisions)
- formula: `decisions_with_retries / terminal_count`
- unit: ratio (0..1) and percent
- windows: 24h, 7d
- dimensions: lane, reason_code
- exclusions: manual training drills
- alert hooks: sustained retry increase week-over-week

## governance rules
- no metric may be introduced without a dictionary entry
- no denominator changes without version bump and migration note
- dashboards must cite metric dictionary version

## open items for v2
- strict definition of baseline bands per lane
- burn-rate style alerting for `hold_rate` and `retry_rate`
- explicit treatment of superseded/annotated lifecycle outcomes
