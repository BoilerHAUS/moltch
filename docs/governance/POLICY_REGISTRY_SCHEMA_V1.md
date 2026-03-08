# policy registry schema v1.1

## metadata
- version: v1.1.0
- owner_role: agent_product_governance
- review_cadence: biweekly
- next_review_due: 2026-03-22

## objective
Define implementation-ready schema contracts for policy registry and actor verification.

## schema set
1. role registry
2. approval policy matrix
3. action request envelope
4. decision event log

## role registry contract
Required fields:
- role_id
- role_type (`human|agent|system`)
- capabilities (array)
- approval_classes (array)
- active (bool)

## approval policy matrix contract
Required fields:
- action_class (`A0|A1|A2|A3`)
- proposer_roles
- approver_roles
- executor_roles
- approval_window_hours
- requires_immutable_log (bool)

## action request envelope contract
Required fields:
- action_id
- action_class
- proposer_actor_id
- payload
- idempotency_key
- request_hash
- created_at_utc

## decision event log contract
Required fields:
- event_id
- action_id
- policy_decision (`allow|deny`)
- approvers
- executor
- reason_code
- ts_utc

## actor verification contract
- Actor identity MUST map from GitHub actor to role-registry actor_id.
- If actor mapping fails, decision MUST fail closed (`blocked_needs_human`).
- If actor is inactive, decision MUST fail closed.

## idempotency + canonical hash contract
- idempotency key TTL: 24h for A1, 12h for A2, 4h for A3.
- request_hash MUST be computed over canonicalized payload:
  - sorted object keys
  - UTF-8 encoding
  - no transient fields (`ts`, `nonce`, `signature`)

## fixture set (required)
- valid payloads: allow path examples
- invalid payloads: deny path examples with error codes
- reproducibility example: same canonical payload -> identical hash across runs

## open questions (target <=3)
1. should inactive actor soft-fail or hard-fail in preview mode? (owner: product/governance)
2. should A0 idempotency keys be optional or required for analytics consistency? (owner: policy engine)
