# architecture (v1)

## metadata
- version: v1.0.2
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

## validation focus
- every side effect has a linked decision record
- denied actions fail closed with explicit reason
- approval and execution identities are traceable
