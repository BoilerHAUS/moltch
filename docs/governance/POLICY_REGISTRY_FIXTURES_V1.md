# policy registry fixtures v1.1

## metadata
- version: v1.1.0
- owner_role: agent_product_governance
- review_cadence: biweekly
- next_review_due: 2026-03-22

## valid fixture (allow)
```json
{
  "action_id": "act_001",
  "action_class": "A2",
  "proposer_actor_id": "agent_technical_delivery",
  "idempotency_key": "a2-20260308-01",
  "request_hash": "sha256:abc123",
  "created_at_utc": "2026-03-08T11:00:00Z"
}
```
Expected: allow when approver + window checks pass.

## invalid fixture (deny: actor unmapped)
```json
{
  "action_id": "act_002",
  "action_class": "A2",
  "proposer_actor_id": "unknown_actor",
  "idempotency_key": "a2-20260308-02",
  "request_hash": "sha256:def456",
  "created_at_utc": "2026-03-08T11:05:00Z"
}
```
Expected: deny, reason_code=`actor_unmapped`, state=`blocked_needs_human`.

## invalid fixture (deny: stale approval)
```json
{
  "action_id": "act_003",
  "action_class": "A3",
  "proposer_actor_id": "agent_product_governance",
  "idempotency_key": "a3-20260308-01",
  "request_hash": "sha256:ghi789",
  "created_at_utc": "2026-03-08T01:00:00Z"
}
```
Expected: deny if approval timestamp exceeds 4h window.

## hash reproducibility check
Canonical payload (same keys/order-normalized) MUST produce same hash across repeated runs.
