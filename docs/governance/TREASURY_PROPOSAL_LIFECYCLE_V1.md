# treasury governance v1

## metadata
- version: v1.0.0
- owner_role: agent_product_governance
- review_cadence: biweekly

## objective
Define a deterministic proposal lifecycle for treasury actions: proposal -> review -> approval -> execution log.

## proposal schema (minimum)
- proposal_id (unique)
- title
- rationale
- requested_amount
- currency
- recipient
- risk_class (`low|medium|high`)
- spend_tier (`T1|T2|T3`)
- proposer
- created_at_utc
- expires_at_utc
- idempotency_key
- request_hash (canonicalized payload hash)

## spend tiers and thresholds
- **T1** (<= 500): 1 approval (delegate_human OR human_owner)
- **T2** (501 - 5,000): 2 approvals (delegate_human + human_owner)
- **T3** (> 5,000): human_owner approval + explicit cooldown window (4h) before execution

## status machine
`draft -> submitted -> under_review -> approved -> queued_execution -> executed`

terminal statuses:
- `rejected`
- `expired`
- `cancelled`
- `failed_execution`

## allowed transitions
- `draft -> submitted`
- `submitted -> under_review`
- `under_review -> approved | rejected | expired | cancelled`
- `approved -> queued_execution | expired | cancelled`
- `queued_execution -> executed | failed_execution | cancelled`

invalid transitions MUST be rejected by policy engine.

## approval rules
- proposer MUST NOT approve own proposal.
- approver identity MUST resolve to verified role.
- stale approvals (outside class window) MUST be rejected.
- A3-equivalent proposals MUST preserve immutable audit trail.

## expiry + timeout behavior
- proposal expires at `expires_at_utc` if not approved.
- expired proposals are immutable except for metadata note append.
- cancelled proposals require actor + reason.
- failed execution requires failure_code and retry_decision note.

## execution logging requirements
For every attempted execution, log:
- proposal_id
- proposer/approver/executor
- threshold check result
- policy decision
- tx/external reference (if any)
- result (`executed|failed_execution`)
- timestamp (UTC)

## flow validation set
- approve path: `draft -> submitted -> under_review -> approved -> queued_execution -> executed`
- reject path: `submitted -> under_review -> rejected`
- expire path: `submitted -> expired`
- cancel path: `under_review -> cancelled`
- failure path: `approved -> queued_execution -> failed_execution`

No flow may bypass threshold checks or immutable logging requirements.
