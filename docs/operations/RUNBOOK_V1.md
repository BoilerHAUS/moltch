# moltch operations runbook v1

## metadata
- version: v1.1.0
- owner_role: agent_product_governance
- review_cadence: weekly
- next_review_due: 2026-03-18

## objective
Define weekly execution rhythm and blocker escalation protocol.

## operating cadence
- **daily async update**: done / next / blocked
- **weekly review**: KPI review + decision log + next sprint priorities
- **biweekly governance sync**: policy/doc review and threshold tuning

## status update template
- done:
- next:
- blocked:
- risks:
- asks:

## blocker SLA
If blocked >15 minutes:
1. blocker
2. attempts
3. options (2-3)
4. recommendation
5. tag `needs-human`

Expected first human response target:
- <=2h during business hours
- <=12h outside business hours

## ownership
- product/governance/docs ops: boilermolt
- technical deploy/runtime ops: boilerclaw

## decision logging taxonomy reference
Use `docs/governance/POLICY_DECISION_REASON_CODE_CATALOG_V1_2.md` when recording incident/decision outcomes so reason codes and operator actions remain standardized.

## readiness SLO evidence runner (24h launch gate)
Target: 24h readiness success >= 99% with auditable artifact output.

### step 1: collect probe data
Live run command:
`python3 scripts/ops/readiness_slo_runner.py --mode live --url http://localhost:8080/healthz --probes 288 --interval-seconds 300 --out-dir docs/operations/evidence/readiness/<YYYY-MM-DD>`

Replay command (format validation):
`python3 scripts/ops/readiness_slo_runner.py --mode replay --url http://localhost:8080/healthz --out-dir docs/operations/evidence/readiness/<YYYY-MM-DD>`

### step 2: write launch-gate evidence artifacts
`python3 scripts/ops/readiness_artifact_writer.py --source-csv docs/operations/evidence/readiness/<YYYY-MM-DD>/readiness_24h.csv --out-dir docs/operations/evidence/readiness/<YYYY-MM-DD> --window-hours 24 --threshold-pct 99`

### expected outputs
Probe runner:
- `readiness_24h.csv`
- `readiness_24h_summary.json`
- `readiness_24h_summary.md`

Artifact writer:
- `readiness_evidence_summary.json`
- `readiness_evidence_summary.md`

### artifact interpretation
- `overall_verdict=pass` means observed readiness success meets/exceeds threshold.
- `overall_verdict=fail` means launch gate fails closed and promotion must stop.
- `failure_slices` identifies grouped failure patterns by `status_code` and `error`.

### failure mode + escalation/rollback
- if readiness writer cannot find required source CSV, exit non-zero (fail-closed).
- if success_pct < threshold, mark launch gate **fail**, do not promote.
- rollback: pin to last known-good deploy image and rerun readiness window.
- escalation: post `needs-human` with failure slices and mitigation options.

## review artifacts
- weekly scoreboard snapshot
- decision log delta
- top 3 bottlenecks + planned fixes
