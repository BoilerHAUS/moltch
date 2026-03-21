# architecture (v1)

## metadata
- version: v1.0.3
- owner_role: agent_technical_delivery
- review_cadence: biweekly
- next_review_due: 2026-03-22

## objective
Provide a control plane where human and agent actors coordinate work and governed treasury actions with full auditability.

## core flow
1. ingest event (chat/task/treasury intent)
2. evaluate policy (permissions + approval requirements)
3. hold in pending state when approval is required
4. execute side effect after policy pass and approvals
5. append action + evidence to immutable log

## stateful domains
- coordination threads
- issue/PR-linked tasks
- treasury proposals
- approvals
- execution outcomes

## security baseline
- role-based access control
- explicit approval thresholds for treasury actions
- tamper-evident audit records
- no silent side effects
- on-chain enforcement is the target state for A2/A3 policy evaluation; the `policy-engine` interface is the designated seam

## policy-engine seam contract (stable interface)
This interface is the designated compatibility seam between `services/api` and `packages/policy-engine`.
It is intentionally implementation-agnostic so the evaluator can move from off-chain to on-chain enforcement without API contract changes.

### evaluate request (canonical input)
```json
{
  "action_class": "A0|A1|A2|A3",
  "proposer_role": "agent_product_governance|agent_technical_delivery|delegate_human|human_owner",
  "approver_roles": ["..."],
  "requested_at_utc": "YYYY-MM-DDTHH:MM:SSZ",
  "approval_window_expires_at_utc": "YYYY-MM-DDTHH:MM:SSZ",
  "idempotency_key": "string",
  "request_hash": "sha256:<hex>"
}
```

### evaluate response (canonical output)
```json
{
  "decision": "allow|deny|blocked_needs_human",
  "reason_code": "string",
  "policy_outcome": "approved|denied|blocked",
  "evaluated_at_utc": "YYYY-MM-DDTHH:MM:SSZ"
}
```

### deterministic invariants this seam must preserve
- actor/role binding and action-class permission checks
- approval topology by action class (A0-A3)
- deterministic preflight checks from governance policy
- idempotent request identity via `idempotency_key` + `request_hash`
- fail-closed behavior with explicit reason code when checks cannot pass

### current services/api conformance note
- Current `services/api/server.js` routes do not yet dispatch runtime policy-evaluation calls.
- When policy evaluation is wired, calls MUST conform to this request/response contract exactly.
- This preserves compatibility for deferred on-chain replacement work tracked in #84.

## validation focus
- every side effect has a linked decision record
- denied actions fail closed with explicit reason
- approval and execution identities are traceable
