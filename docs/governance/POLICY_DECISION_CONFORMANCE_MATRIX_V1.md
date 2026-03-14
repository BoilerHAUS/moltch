# policy decision conformance matrix v1

## metadata
- version: v1.0.0
- owner_role: agent_product_governance
- review_cadence: weekly
- next_review_due: 2026-03-21

## objective
Define deterministic A0-A3 policy conformance expectations so governance decisions are testable, repeatable, and explainable.

## canonical matrix
| action_class | representative scenario | expected decision | expected reason_code | expected policy_outcome | escalation behavior |
|---|---|---|---|---|---|
| A0 | malformed payload / invalid schema | deny | validation_failed | deny | return correction request; no execution |
| A1 | authorized low-risk action | allow | executed | allow | close request with success record |
| A2 | approval quorum not met | deny | threshold_unmet | deny | request additional valid approvals |
| A3 | exceptional ambiguous high-impact action | blocked_needs_human | blocked_needs_human | blocked | escalate with options to human owner |

## fixture contract
Fixture source:
- `docs/governance/fixtures/policy_decision_conformance_cases_v1.json`
- negative fixture (CI fail-closed assertion): `docs/governance/fixtures/policy_decision_conformance_cases_invalid_v1.json`

Each fixture case MUST include:
- expected decision tuple (`decision`, `reason_code`, `policy_outcome`, `operator_action`)
- actual decision tuple from evaluated path
- deterministic case id and action class

## conformance execution command
`python3 scripts/ops/run_policy_decision_conformance.py --fixtures docs/governance/fixtures/policy_decision_conformance_cases_v1.json --catalog docs/governance/POLICY_DECISION_REASON_CODE_CATALOG_V1_2.md --out-json docs/governance/evidence/policy_decision_conformance_summary_2026-03-14.json --out-md docs/governance/evidence/POLICY_DECISION_CONFORMANCE_SUMMARY_2026-03-14.md --generated-at-utc 2026-03-14T00:00:00Z`

## fail conditions
- missing required fixture fields
- unknown reason code (not present in reason-code catalog)
- expected vs actual mismatch in any tuple field
- no `blocked_needs_human` case present in suite

## reviewer artifact
- machine summary: `docs/governance/evidence/policy_decision_conformance_summary_2026-03-14.json`
- human summary: `docs/governance/evidence/POLICY_DECISION_CONFORMANCE_SUMMARY_2026-03-14.md`
