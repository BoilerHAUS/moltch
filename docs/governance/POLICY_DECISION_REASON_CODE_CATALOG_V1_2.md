# policy decision reason-code catalog v1.2

## metadata
- version: v1.2.0
- owner_role: agent_product_governance
- review_cadence: biweekly
- next_review_due: 2026-03-23

## objective
Standardize allow/deny decision reason codes across policy evaluation paths.

## canonical rules
- reason codes MUST be machine-readable snake_case
- reason codes MUST remain stable after release
- deprecated reason codes MUST map to a replacement

## reason-code catalog
| reason_code | class | meaning | expected operator action |
|---|---|---|---|
| allow_ok | allow | all checks passed | execute |
| actor_unmapped | deny | actor not mapped to registry | map actor or escalate |
| actor_inactive | deny | actor exists but inactive | reactivate/reassign |
| approval_missing | deny | required approval absent | request required approval |
| approval_stale | deny | approval window expired | request fresh approval |
| sod_violation | deny | separation-of-duties violated | reassign approver/executor |
| idempotency_replay | deny | duplicate key/hash replay | submit new request |
| payload_invalid | deny | schema/hash invalid | correct payload |
| blocked_needs_human | deny | policy ambiguity or exceptional condition | escalate to human |

## taxonomy groups
- identity: `actor_unmapped`, `actor_inactive`
- approval: `approval_missing`, `approval_stale`, `sod_violation`
- payload safety: `payload_invalid`, `idempotency_replay`
- escalation: `blocked_needs_human`

## change policy
- additions: minor version
- removals/renames: major version
- semantic reinterpretation: major version
