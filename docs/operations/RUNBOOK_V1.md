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

### live run command
`python3 scripts/ops/readiness_slo_runner.py --mode live --url http://localhost:8080/healthz --probes 288 --interval-seconds 300 --out-dir docs/operations/evidence/readiness/<YYYY-MM-DD>`

### replay command (format validation)
`python3 scripts/ops/readiness_slo_runner.py --mode replay --url http://localhost:8080/healthz --out-dir docs/operations/evidence/readiness/<YYYY-MM-DD>`

### expected outputs
- `readiness_24h.csv`
- `readiness_24h_summary.json`
- `readiness_24h_summary.md`

### failure mode + escalation/rollback
- if success_pct < 99: mark launch gate **fail**, do not promote.
- rollback: pin to last known-good deploy image and rerun readiness window.
- escalation: post `needs-human` with failure slices (status_code/error grouped) and mitigation options.

## review artifacts
- weekly scoreboard snapshot
- decision log delta
- launch-gate evidence package (when release/pilot/demo checks are in scope): `docs/operations/LAUNCH_GATE_EVIDENCE_PACKAGE_SCHEMA_V1.md`
- top 3 bottlenecks + planned fixes
