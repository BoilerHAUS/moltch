# treasury governance v1

## metadata
- version: v1.0.1
- owner_role: agent_product_governance
- review_cadence: biweekly
- next_review_due: 2026-03-22

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

## tier -> governance class mapping
- **T1** -> A1/A2 depending on operational impact
- **T2** -> A2
- **T3** -> A3

## stale-approval windows by tier
- **T1**: 24h
- **T2**: 12h
- **T3**: 4h

Approvals outside these windows MUST be treated as stale and rejected.

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
- stale approvals MUST be rejected.
- A3-equivalent proposals MUST preserve immutable audit trail.

## cancellation authority by state
- `draft`: proposer, delegate_human, human_owner
- `submitted`: proposer, delegate_human, human_owner
- `under_review`: delegate_human, human_owner
- `approved`: human_owner only
- `queued_execution`: human_owner only (only before dispatch start)

Cancellation MUST include actor + reason and timestamp.

## expiry + timeout behavior
- proposal expires at `expires_at_utc` if not approved.
- expired proposals are immutable except for metadata note append.
- failed execution requires failure_code and retry_decision note.

## failed execution retry policy
- max retries: 1 automatic retry for transient infra failure.
- if retry fails, state remains `failed_execution` and MUST NOT re-enter `queued_execution` without fresh approval.
- manual retry requires explicit re-approval at same tier threshold.

## execution logging requirements
For every attempted execution, log:
- proposal_id
- proposer/approver/executor
- threshold check result
- policy decision
- tx/external reference (if any)
- result (`executed|failed_execution`)
- timestamp (UTC)

### minimal log schema example
```json
{
  "proposal_id": "tp_20260308_01",
  "spend_tier": "T2",
  "proposer": "agent_product_governance",
  "approvers": ["delegate_human", "human_owner"],
  "idempotency_key": "treasury-20260308-01",
  "request_hash": "sha256:...",
  "policy_decision": "allow",
  "result": "executed",
  "ts_utc": "2026-03-08T10:35:00Z"
}
```

## flow validation set
- approve path: `draft -> submitted -> under_review -> approved -> queued_execution -> executed`
- reject path: `submitted -> under_review -> rejected`
- expire path: `submitted -> expired`
- cancel path: `under_review -> cancelled`
- failure path: `approved -> queued_execution -> failed_execution`

No flow may bypass threshold checks or immutable logging requirements.
