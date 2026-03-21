# policy decision reason-code catalog v1.3

## metadata
- version: v1.3.0
- owner_role: agent_product_governance
- review_cadence: biweekly
- next_review_due: 2026-03-26

## objective
Standardize governance decision reason codes for allow/deny/blocked outcomes, and map each code to expected operator action.

## canonical rules
- reason codes MUST be machine-readable snake_case
- reason codes MUST remain stable after release
- deprecated reason codes MUST map to a replacement
- every decision log entry SHOULD include: `action_class`, `reason_code`, `policy_outcome`, `operator_action`

## required baseline codes (issue #67)
- `permission_denied`
- `missing_approval`
- `threshold_unmet`
- `validation_failed`
- `execution_failed`
- `executed`

## deterministic reason-code table
| reason_code | policy_outcome | when it applies | expected operator action |
|---|---|---|---|
| executed | allow | all checks passed and side effect completed | record success and close request |
| permission_denied | deny | actor lacks required role/capability | route to authorized actor or escalate |
| missing_approval | deny | required approver has not approved | request missing approval(s) |
| threshold_unmet | deny | approvals exist but required threshold/topology is not met | collect additional valid approvals |
| validation_failed | deny | payload/schema/hash/constraint validation failed | correct payload and resubmit |
| execution_failed | deny | policy approved but downstream execution failed | triage runtime failure, retry if safe |
| blocked_needs_human | blocked | ambiguous/exceptional case requiring manual judgment | escalate to human owner with options |
| approval_stale | deny | approval exists but expired outside approval window | request fresh approval |
| idempotency_replay | deny | duplicate idempotency key/request hash replay | issue a fresh request id/key |
| sod_violation | deny | separation-of-duties boundary violated | reassign actor to satisfy SoD |
| actor_unmapped | deny | actor identity not registered in policy registry | map actor identity before retry |
| actor_inactive | deny | actor is registered but inactive/suspended | reactivate or reassign actor |

## taxonomy groups
- identity: `actor_unmapped`, `actor_inactive`, `permission_denied`
- approval: `missing_approval`, `threshold_unmet`, `approval_stale`, `sod_violation`
- validation: `validation_failed`, `idempotency_replay`
- execution: `executed`, `execution_failed`
- escalation: `blocked_needs_human`

## decision-log examples (operator actionable)
```json
{"request_id":"req-1001","action_class":"A1","reason_code":"permission_denied","policy_outcome":"deny","operator_action":"route_to_authorized_actor","status":"closed"}
{"request_id":"req-1002","action_class":"A2","reason_code":"missing_approval","policy_outcome":"deny","operator_action":"request_required_approvals","status":"pending"}
{"request_id":"req-1003","action_class":"A2","reason_code":"threshold_unmet","policy_outcome":"deny","operator_action":"collect_additional_approval","status":"pending"}
{"request_id":"req-1004","action_class":"A0","reason_code":"validation_failed","policy_outcome":"deny","operator_action":"fix_payload_and_resubmit","status":"closed"}
{"request_id":"req-1005","action_class":"A3","reason_code":"execution_failed","policy_outcome":"deny","operator_action":"triage_executor_and_retry_if_safe","status":"investigating"}
{"request_id":"req-1006","action_class":"A1","reason_code":"executed","policy_outcome":"allow","operator_action":"record_and_close","status":"done"}
```

## change policy
- additions: minor version
- removals/renames: major version
- semantic reinterpretation: major version
