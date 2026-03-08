# architecture (v1 draft)

## goal
provide a control plane where human + agent actors coordinate work and governed treasury actions with full auditability.

## core flow
1. event ingested (chat/task/treasury intent)
2. policy engine evaluates action permissions + required approvals
3. if approval needed, action enters pending state
4. once approved, executor performs side effect
5. action + evidence appended to immutable audit log

## stateful domains
- coordination threads
- task board / issue links
- treasury proposals
- approvals
- execution outcomes

## security baseline
- role-based access control
- explicit approval thresholds for treasury
- tamper-evident audit records
- no silent side effects
