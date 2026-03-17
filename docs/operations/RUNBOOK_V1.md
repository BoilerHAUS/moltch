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

## launch-gate evidence schema validation
Use this before opening/merging launch-gate evidence PRs:

`python3 scripts/ops/validate_launch_gate_evidence.py --schema docs/operations/schemas/LAUNCH_GATE_EVIDENCE_PACKAGE_V1.schema.json --input docs/operations/evidence/launch_gate_evidence_package_valid_v1.json`

- non-zero exit means schema violation (missing fields / invalid enums / wrong types / unexpected additional properties)

## evidence-pack assembly service (deterministic)
Assemble one reviewer-ready evidence bundle from issue/PR/CI/validator inputs:

`python3 scripts/ops/build_evidence_pack.py --config docs/operations/evidence/assembler/evidence_pack_config_v1.json --out-dir docs/operations/evidence/assembler/<YYYY-MM-DD>`

Outputs:
- `bundle_manifest.json`
- `bundle_checksums.json`
- `validation_report.json`
- `bundle_summary.md`

Determinism:
- `bundle_id` is derived from canonical manifest hash (`manifest_sha256`)
- same inputs produce same manifest/checksum identity
- CI enforces multi-artifact validation via `scripts/docs/check_docs.sh`:
  - valid fixtures: canonical + edge variant
  - invalid fixtures: missing-required + invalid-enum + typo/additional-property variants (must fail)

## launch-readiness packet assembly (fail-closed)
Build one reviewer-ready packet from required evidence manifest:

`python3 scripts/ops/build_launch_readiness_packet.py --manifest docs/operations/evidence/launch-readiness/launch_readiness_packet_manifest_v1.json --out-dir docs/operations/evidence/launch-readiness/2026-03-14-dry-run`

- non-zero exit means required evidence input is missing or manifest fields are invalid
- packet decision is computed from status signals (manifest rationale is non-authoritative)

Decision derivation rules:
1. Any of the following forces `no-go`: failed required checks, readiness fail, evidence incomplete, abort gate triggered.
2. If no hard-fail but freshness/lineage checks fail, decision is `hold`.
3. Only all-green signals produce `go`.

Freshness/lineage contract:
- `status_signals.source_data_age_hours` must be <= `freshness.max_source_age_hours` for `go`.
- if `freshness.require_same_commit_lineage=true`, `status_signals.source_commit_sha` must match packet `source_commit_sha` for `go`.

- outputs:
  - `docs/operations/evidence/launch-readiness/2026-03-14-dry-run/launch_readiness_packet.json`
  - `docs/operations/evidence/launch-readiness/2026-03-14-dry-run/launch_readiness_packet.md`

## soak validation (production-like durability gate)
Plan and thresholds:
- `docs/operations/SOAK_VALIDATION_PLAN_2026-03.md`

Evidence memo template:
- `docs/operations/evidence/soak/SOAK_EVIDENCE_MEMO_TEMPLATE.md`

Hold-path dry-run artifact:
- `docs/operations/evidence/soak/SOAK_HOLD_PATH_DRY_RUN_2026-03-14.md`

Operational requirement:
- final memo must end in explicit `go` / `hold` / `no-go` plus one counterfactual that would flip the decision.
- any abort gate trigger forces `no-go`; remediation requires a fresh full soak window.

## policy decision conformance suite (A0-A3)
Run policy decision conformance checks:

`python3 scripts/ops/run_policy_decision_conformance.py --fixtures docs/governance/fixtures/policy_decision_conformance_cases_v1.json --catalog docs/governance/POLICY_DECISION_REASON_CODE_CATALOG_V1_2.md --out-json docs/governance/evidence/policy_decision_conformance_summary_2026-03-14.json --out-md docs/governance/evidence/POLICY_DECISION_CONFORMANCE_SUMMARY_2026-03-14.md --generated-at-utc 2026-03-14T00:00:00Z`

- non-zero exit means conformance mismatch (missing reason code, unexpected decision tuple, or missing requires-human case)
- include the generated markdown summary in reviewer signoff threads

## launch signoff entrypoint
- canonical evidence index: `docs/operations/evidence/LAUNCH_EVIDENCE_INDEX_2026-03.md`

## launch-gate contract CI signal
- workflow: `.github/workflows/launch-gate-contracts.yml` (check name: `launch-gate-contracts`)
- triage order when it fails:
  1) schema fixtures (`scripts/ops/validate_launch_gate_evidence.py`)
  2) launch-readiness packet derivation (`scripts/ops/build_launch_readiness_packet.py`)
  3) policy conformance fixtures (`scripts/ops/run_policy_decision_conformance.py`)

## review artifacts
- weekly review-ops scoreboard spec: `docs/operations/REVIEW_OPS_SCOREBOARD_SPEC_V1.md`
- weekly scoreboard snapshot (generated): `docs/operations/evidence/review-ops/2026-W11/review_ops_scoreboard.md`
- decision log delta
- policy conformance summary: `docs/governance/evidence/POLICY_DECISION_CONFORMANCE_SUMMARY_2026-03-14.md`
- launch decision memo refresh (current): `docs/product/V1_LAUNCH_DECISION_MEMO_2026-03-15.md`
- launch-gate evidence package (when release/pilot/demo checks are in scope): `docs/operations/LAUNCH_GATE_EVIDENCE_PACKAGE_SCHEMA_V1.md`
- launch-readiness packet (signoff assembly): `docs/operations/evidence/launch-readiness/2026-03-14-dry-run/launch_readiness_packet.md`
- soak evidence memo (durability gate): `docs/operations/evidence/soak/SOAK_EVIDENCE_MEMO_TEMPLATE.md`
- top 3 bottlenecks + planned fixes
