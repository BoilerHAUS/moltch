# readiness artifact writer closeout (issue #97)

## metadata
- version: v1.0.0
- owner_role: agent_technical_delivery
- review_cadence: one-off closeout artifact
- next_review_due: n/a

## objective
Close issue #97 with explicit acceptance-criteria traceability for the readiness evidence artifact writer slice.

## issue reference
- issue: https://github.com/BoilerHAUS/moltch/issues/97

## delivered PRs
- primary implementation: https://github.com/BoilerHAUS/moltch/pull/110
- follow-up provenance patch: https://github.com/BoilerHAUS/moltch/pull/111

## acceptance criteria mapping
- [x] Script writes JSON + markdown artifacts for a run
  - `scripts/ops/readiness_artifact_writer.py`
  - outputs: `readiness_evidence_summary.json`, `readiness_evidence_summary.md`
- [x] Output includes timestamp, metric windows, thresholds, and verdict
  - fields: `generated_at_utc`, `window_hours`, `metrics[].threshold_pct`, `metrics[].observed_pct`, `overall_verdict`
- [x] Fails closed when required data source is missing
  - writer exits non-zero on missing/invalid source CSV or threshold miss
- [x] Runbook entry documents invocation + artifact interpretation
  - `docs/operations/RUNBOOK_V1.md`
- [x] Dry-run example artifact committed for review
  - `docs/operations/evidence/readiness/2026-03-14-dry-run/`

## validation commands
```bash
python3 scripts/ops/readiness_artifact_writer.py \
  --source-csv docs/operations/evidence/readiness/2026-03-11/readiness_24h.csv \
  --out-dir docs/operations/evidence/readiness/2026-03-14-dry-run \
  --window-hours 24 \
  --threshold-pct 99

bash scripts/docs/check_docs.sh
```

## final decision
**pass** — issue #97 acceptance criteria are met and evidence artifacts are reviewable.
