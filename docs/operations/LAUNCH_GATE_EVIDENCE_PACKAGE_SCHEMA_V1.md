# launch-gate evidence package schema v1

## metadata
- version: v1.0.0
- owner_role: agent_technical_delivery
- review_cadence: biweekly
- next_review_due: 2026-03-28

## purpose
Define one auditable artifact contract for pilot/demo launch-gate evidence so issue-to-PR readiness decisions use consistent, reviewable data.

## contract summary
Each launch-gate package MUST include all required sections below. A package is `pass` only if every required check-level field has status `pass`.

## required fields

### 1) package header
- `package_id` (string, required): unique id, format `lgep-YYYYMMDD-<slug>`
- `generated_at_utc` (string, required): ISO8601 UTC timestamp
- `prepared_by` (string, required): operator/agent handle
- `scope_refs` (array<string>, required): source issue ids (e.g. `#68`, `#70`, `#74`)
- `target_environment` (string, required): `staging` | `preprod` | `prod-like`
- `overall_result` (string, required): `pass` | `fail`

### 2) traceability block
- `traceability.issue` (string, required): canonical issue URL
- `traceability.pull_request` (string, required): canonical PR URL
- `traceability.commit_sha` (string, required): merge/head SHA used for validation
- `traceability.runbook_refs` (array<string>, required): runbook/doc links used during validation

Pass/fail semantics:
- `pass` only if issue, PR, and commit SHA resolve and point to the same delivered scope.
- Otherwise `fail`.

### 3) CI and checks block
- `ci.workflow_name` (string, required)
- `ci.run_url` (string, required)
- `ci.required_checks` (array<object>, required) where each object contains:
  - `name` (string, required)
  - `status` (string, required): `pass` | `fail`
  - `evidence` (string, required): log URL, run step URL, or artifact reference

Pass/fail semantics:
- `pass` only if all required checks have `status=pass`.
- any failed required check forces package `overall_result=fail`.

### 4) runtime/smoke/readiness block
- `runtime.environment_snapshot` (string, required): image tag/version + deploy context
- `runtime.smoke` (object, required):
  - `status` (`pass` | `fail`)
  - `script_ref` (string, required)
  - `artifact_ref` (string, required)
- `runtime.readiness` (object, required):
  - `status` (`pass` | `fail`)
  - `endpoint_ref` (string, required)
  - `observed_at_utc` (string, required)

Pass/fail semantics:
- runtime section is `pass` only if both smoke and readiness are `pass`.

### 5) decision memo summary block
- `decision.summary` (string, required): 1-3 sentence release recommendation
- `decision.reason_codes` (array<string>, required): from governance reason-code catalog
- `decision.risks` (array<string>, required)
- `decision.follow_ups` (array<string>, required)
- `decision.approver` (string, required): final accountable approver

Pass/fail semantics:
- decision block is valid only if reason codes are non-empty and approver is identified.

## canonical template (copy/paste)
```yaml
package_id: lgep-20260314-pilot-closeout
generated_at_utc: 2026-03-14T00:00:00Z
prepared_by: boilerclaw
scope_refs: ["#68", "#70", "#74"]
target_environment: staging
overall_result: pass

traceability:
  issue: https://github.com/BoilerHAUS/moltch/issues/68
  pull_request: https://github.com/BoilerHAUS/moltch/pull/109
  commit_sha: abcdef1234567890abcdef1234567890abcdef12
  runbook_refs:
    - docs/operations/RUNBOOK_V1.md
    - docs/operations/DEPLOY_STAGING.md

ci:
  workflow_name: deploy-guardrails
  run_url: https://github.com/BoilerHAUS/moltch/actions/runs/1234567890
  required_checks:
    - name: deploy-guardrails
      status: pass
      evidence: https://github.com/BoilerHAUS/moltch/actions/runs/1234567890/job/111
    - name: repo-baseline
      status: pass
      evidence: https://github.com/BoilerHAUS/moltch/actions/runs/1234567890/job/222

runtime:
  environment_snapshot: staging image web:sha-2d4f0a1 api:sha-2d4f0a1
  smoke:
    status: pass
    script_ref: scripts/staging/smoke.sh
    artifact_ref: artifacts/smoke-20260314.json
  readiness:
    status: pass
    endpoint_ref: GET /ready
    observed_at_utc: 2026-03-14T00:05:12Z

decision:
  summary: "Pilot/demo launch gate passes based on CI, smoke, and readiness evidence."
  reason_codes: ["DEPLOY_GUARDRAIL_PASS", "READINESS_GREEN"]
  risks:
    - "No production traffic validation yet; staging-only evidence."
  follow_ups:
    - "Run 24h soak check before external pilot expansion."
  approver: boilerrat
```

## worked example package (complete)
### example result: pass
- package_id: `lgep-20260314-demo-slice-a`
- scope_refs: `#68`, `#70`, `#74`
- traceability: issue/PR/SHA aligned
- CI checks: `deploy-guardrails=pass`, `repo-baseline=pass`
- runtime checks: smoke `pass`, readiness `pass`
- decision summary: proceed to controlled demo release with listed follow-ups

### evaluator checklist
1. Verify issue/PR/SHA alignment.
2. Confirm all required checks are `pass` with evidence links.
3. Confirm smoke/readiness snapshots exist and timestamps are recent.
4. Confirm decision memo includes reason codes + approver.
5. Set `overall_result=pass` only if all sections pass.

## roadmap mapping
- supports launch-gate evidence quality for issues `#68`, `#70`, and `#74`.
- designed to keep acceptance criteria auditable and repeatable across demo slices.
