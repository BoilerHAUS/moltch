# launch evidence index (2026-03)

## purpose
Canonical entrypoint for v1 launch signoff evidence.

Use this page first during go/hold/no-go review.

## canonical artifact links

### 1) contract + schema validation
- launch-gate schema spec: `docs/operations/LAUNCH_GATE_EVIDENCE_PACKAGE_SCHEMA_V1.md`
- machine schema: `docs/operations/schemas/LAUNCH_GATE_EVIDENCE_PACKAGE_V1.schema.json`
- validator script: `scripts/ops/validate_launch_gate_evidence.py`

### 2) launch-readiness packet
- packet (markdown): `docs/operations/evidence/launch-readiness/2026-03-14-dry-run/launch_readiness_packet.md`
- packet (json): `docs/operations/evidence/launch-readiness/2026-03-14-dry-run/launch_readiness_packet.json`
- packet builder script: `scripts/ops/build_launch_readiness_packet.py`
- packet manifest (baseline): `docs/operations/evidence/launch-readiness/launch_readiness_packet_manifest_v1.json`

### 3) readiness + runtime evidence
- readiness summary (json): `docs/operations/evidence/readiness/2026-03-14-dry-run/readiness_evidence_summary.json`
- readiness summary (markdown): `docs/operations/evidence/readiness/2026-03-14-dry-run/readiness_evidence_summary.md`
- demo1 evidence package: `docs/operations/evidence/LAUNCH_GATE_DEMO1_EVIDENCE_PACKAGE_2026-03-14.md`
- demo2 edge evidence package: `docs/operations/evidence/LAUNCH_GATE_DEMO2_EDGE_EVIDENCE_PACKAGE_2026-03-14.md`

### 4) soak + durability gate
- soak plan: `docs/operations/SOAK_VALIDATION_PLAN_2026-03.md`
- soak memo template: `docs/operations/evidence/soak/SOAK_EVIDENCE_MEMO_TEMPLATE.md`
- soak hold-path dry-run: `docs/operations/evidence/soak/SOAK_HOLD_PATH_DRY_RUN_2026-03-14.md`

### 5) governance + policy evidence
- policy reason-code catalog: `docs/governance/POLICY_DECISION_REASON_CODE_CATALOG_V1_2.md`
- policy conformance summary: `docs/governance/evidence/POLICY_DECISION_CONFORMANCE_SUMMARY_2026-03-14.md`
- policy conformance summary (json): `docs/governance/evidence/policy_decision_conformance_summary_2026-03-14.json`
- pilot commercial loop decision memo: `docs/product/PILOT_COMMERCIAL_LOOP_DECISION_MEMO_2026-03-14.md`

### 6) review-ops telemetry
- review-ops scoreboard spec: `docs/operations/REVIEW_OPS_SCOREBOARD_SPEC_V1.md`
- latest scoreboard snapshot: `docs/operations/evidence/review-ops/2026-W11/review_ops_scoreboard.md`

## missing / needs-refresh checklist
Use this table to make gaps explicit before final signoff.

| item | status | owner | due_date_utc | notes |
|---|---|---|---|---|
| launch-readiness packet regenerated on latest `main` SHA | [ ] | boilerclaw | YYYY-MM-DD | update packet artifacts + manifest traceability |
| fresh readiness evidence window (24h) attached | [ ] | boilerclaw | YYYY-MM-DD | include latest summary refs |
| latest decision memo refreshed from current evidence set | [ ] | boilermolt | YYYY-MM-DD | explicit go/hold/no-go + counterfactual |
| final approver signoff captured in issue/PR thread | [ ] | boilerrat | YYYY-MM-DD | link decision thread |

## signoff use protocol
1. Confirm all checklist rows are resolved or explicitly accepted as risk.
2. Verify launch-readiness packet decision aligns with policy and runtime evidence.
3. Record final verdict (`go` / `hold` / `no-go`) in governance memo with links to this index.
