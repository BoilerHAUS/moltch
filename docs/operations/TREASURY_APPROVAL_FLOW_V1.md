# treasury approval flow v1

## metadata
- version: v1.0.0
- owner_role: agent_product_governance
- review_cadence: weekly
- next_review_due: 2026-03-28

## objective
Define the first governed treasury control surface for `BoilerHAUS/moltch`: proposal -> approval -> execution, with fail-closed execution rules, separation of duties, budget reservation, and auditable denial paths.

## scope
This slice defines:
- treasury proposal artifact requirements
- admissibility rules before a proposal becomes reviewable
- approval matrix by amount tier, risk class, and actor role
- proposal lifecycle and terminal states
- execution readiness gates after approval
- emergency pause semantics
- audit and denial-reason requirements
- worked examples for low/medium/high-risk treasury actions

This slice does **not** attempt to solve:
- wallet/provider integration
- on-chain execution wiring
- automatic market/risk pricing
- agent-only treasury fast paths
- fully autonomous spending authority

## governance posture
Treasury controls are treated as a governance/control-plane problem before they are treated as a payments problem.

Hard v1 guardrails:
- **no agent-only fast path** for treasury actions in v1
- **separation of duties**: a proposer may not unilaterally satisfy both approval and execution on the same treasury action
- **policy before execution**: execution consumes a validated proposal artifact, not freeform operator intent
- **pause wins**: if an applicable emergency pause is active, execution fails closed with an auditable reason

## actor roles
Named actor roles for this slice:
- `human_owner`
- `human_operator`
- `agent_operator`
- `agent_reviewer`
- `governance_reviewer`

Role intent:
- `human_owner`: final authority for high-risk treasury actions and pause release
- `human_operator`: may propose and execute within policy but cannot bypass approval rules
- `agent_operator`: may prepare proposals and execute only when policy explicitly allows and a distinct approval path has succeeded
- `agent_reviewer`: non-owner review participant for lower/medium-risk proposals
- `governance_reviewer`: reviewer role for high-risk, pause-sensitive, or exceptional actions

## risk classes and amount tiers
### risk classes
- `R0_recurring_operational`
- `R1_standard_transfer`
- `R2_treasury_reallocation`
- `R3_permission_or_key_change`

Interpretation:
- recurring operational spend is lowest-risk when bounded and vendor-known
- standard transfer covers one-off non-routine value movement
- treasury reallocation covers strategic capital movement between wallets/treasury buckets
- permission/key changes are always high-risk regardless of notional amount

### amount tiers
- `T0_micro`: <= 100 USD equivalent
- `T1_low`: > 100 and <= 1,000 USD equivalent
- `T2_medium`: > 1,000 and <= 10,000 USD equivalent
- `T3_high`: > 10,000 USD equivalent

The active policy engine may later use different thresholds, but every executed proposal must still resolve to one named tier at evaluation time.

## treasury proposal artifact
Every treasury action request must be represented as a proposal artifact before review.

Required fields:
- `proposal_version = treasury_approval_flow.v1`
- `proposal_id`
- `generated_at_utc`
- `action_type`
- `risk_class`
- `amount`
- `asset`
- `target_ref`
- `requested_by`
- `requested_role`
- `justification`
- `evidence_refs`
- `valid_until_utc`
- `required_approvals`
- `execution_role_candidates`
- `budget_scope`
- `policy_version`
- `pause_scope_affected`
- `proposal_hash`

### canonical example shape
```json
{
  "proposal_version": "treasury_approval_flow.v1",
  "proposal_id": "treasury-proposal-001",
  "generated_at_utc": "2026-03-21T00:00:00Z",
  "action_type": "vendor_payment",
  "risk_class": "R0_recurring_operational",
  "amount": 250,
  "asset": "USDC",
  "target_ref": "vendor:hosting:invoice-2026-03",
  "requested_by": "agent_operator:boilerclaw",
  "requested_role": "agent_operator",
  "justification": "Monthly staging hosting invoice",
  "evidence_refs": [
    "docs/operations/evidence/vendor_invoice_hosting_2026_03.md"
  ],
  "valid_until_utc": "2026-03-28T00:00:00Z",
  "required_approvals": [
    "human_operator",
    "agent_reviewer"
  ],
  "execution_role_candidates": [
    "human_operator"
  ],
  "budget_scope": "ops_monthly_usdc",
  "policy_version": "treasury_approval_flow.v1",
  "pause_scope_affected": "treasury_all",
  "proposal_hash": "sha256:example"
}
```

## proposal admissibility rules
A proposal is admissible only when all are true:
- required fields are present and non-empty
- `risk_class`, amount tier, and `action_type` are mutually coherent
- evidence references exist and justify the spend/request
- `valid_until_utc` is in the future at review time
- `requested_role` is allowed to propose that action type
- `required_approvals` matches the active approval matrix for the exact resolved tier/risk class
- `execution_role_candidates` excludes the sole proposer when separation of duties would be violated
- `proposal_hash` is stable across the reviewed execution payload

If any admissibility rule fails, the proposal is not reviewable and must remain outside the approval lane.

## approval matrix (v1)
| amount_tier | risk_class | minimum approval requirement | mandatory human participation | execution constraint |
|---|---|---|---|---|
| `T0_micro` | `R0_recurring_operational` | 1 `human_operator` + 1 `agent_reviewer` | yes | executor must not be the proposer |
| `T1_low` | `R0_recurring_operational` | 1 `human_operator` + 1 `agent_reviewer` | yes | executor must not be the proposer |
| `T1_low` | `R1_standard_transfer` | 1 `human_owner` + 1 `agent_reviewer` | yes | executor must be distinct from proposer and one approver |
| `T2_medium` | `R1_standard_transfer` | 1 `human_owner` + 1 `governance_reviewer` | yes | executor must be distinct from proposer and all approvers |
| `T2_medium` | `R2_treasury_reallocation` | 1 `human_owner` + 1 `governance_reviewer` + 1 `agent_reviewer` | yes | executor must be distinct from proposer and all approvers |
| `T3_high` | `R2_treasury_reallocation` | 2 human approvals, one of which is `human_owner`, + 1 `governance_reviewer` | yes | executor must be distinct from proposer and all approvers |
| any tier | `R3_permission_or_key_change` | 2 human approvals, one of which is `human_owner`, + 1 `governance_reviewer` | yes | no agent may execute alone |

Interpretation rules:
- if amount tier and risk class disagree on strictness, the stricter policy wins
- policy must evaluate against the exact proposal hash under review
- approval sufficiency does not itself imply execution readiness

## budget reservation rules
Approval is not just a budget check; it creates a reservation.

Rules:
- approved proposals reserve against `budget_scope` for their amount until executed, expired, cancelled, or rejected
- parallel proposals may not over-commit the same budget scope
- execution must fail closed if reservation coverage is no longer valid at execution time
- releasing a reservation must be auditable and tied to a lifecycle transition

## emergency pause semantics
Pause scope values for this slice:
- `treasury_all`
- `treasury_transfers`
- `treasury_permissions`

Rules:
- pause trigger authority: `human_owner` or explicitly authorized `governance_reviewer`
- pause lift authority: `human_owner` only
- pause effect: execution fails closed for proposals whose `pause_scope_affected` overlaps the active pause
- pause does not delete proposals or approvals; it blocks execution until lifted or the proposal expires/cancels

## lifecycle state machine
```text
draft
  -> proposed
  -> rejected
  -> cancelled

proposed
  -> under_review
  -> rejected
  -> expired
  -> cancelled

under_review
  -> approved
  -> rejected
  -> expired
  -> cancelled

approved
  -> paused_blocked
  -> executed
  -> expired
  -> cancelled

paused_blocked
  -> approved
  -> expired
  -> cancelled

executed (terminal)
rejected (terminal)
expired (terminal)
cancelled (terminal)
```

### state meanings
- `draft`: local proposal preparation only; not yet reviewable
- `proposed`: artifact submitted and awaiting admissibility/review checks
- `under_review`: admissible and currently collecting approvals
- `approved`: quorum satisfied for the exact proposal hash
- `paused_blocked`: approval exists, but execution is currently blocked by active pause
- `executed`: action completed under a valid execution gate
- `rejected`: denied by policy or reviewers
- `expired`: validity window elapsed before execution
- `cancelled`: proposer/operator withdrew before execution

## fail-closed execution gate
A treasury action may execute only when all are true at execution time:
- the proposal is in `approved`
- the active `policy_version` matches the proposal’s `policy_version`
- the approval quorum is sufficient for the exact `proposal_hash`
- approval records are still within validity policy
- budget reservation remains valid and unexhausted
- no overlapping emergency pause applies
- executor role is permitted by policy and does not violate separation of duties

If any condition fails, execution must not proceed.

## denial reason taxonomy
All rejected, cancelled, expired, or blocked outcomes should record one or more reason codes:
- `proposal_invalid`
- `evidence_missing`
- `approval_quorum_insufficient`
- `approval_stale`
- `policy_version_mismatch`
- `budget_reservation_unavailable`
- `pause_active`
- `separation_of_duties_violation`
- `execution_role_not_allowed`
- `proposal_hash_mismatch`
- `proposal_expired`
- `cancelled_by_requester`

## audit requirements
The audit trail must allow a reviewer to reconstruct:
- who proposed the action
- what exact artifact hash was reviewed
- which evidence supported admissibility
- who approved or rejected and under which role
- whether budget reservation was created, consumed, released, or denied
- whether pause blocked execution
- who executed and when
- which denial reason codes applied when execution did not occur

Minimum audited transitions:
- draft -> proposed
- proposed -> under_review
- under_review -> approved/rejected/expired/cancelled
- approved -> paused_blocked/executed/expired/cancelled
- paused_blocked -> approved/expired/cancelled

## worked examples (fixture-style)
### example A: low-risk recurring operational spend
- action: monthly hosting payment
- resolved policy: `T1_low` + `R0_recurring_operational`
- proposal admissible with invoice evidence and current budget scope
- approvals: `human_operator` + `agent_reviewer`
- executor: distinct `human_operator`
- result: executes if budget reservation still valid and no pause is active

### example B: medium-risk one-off transfer
- action: one-off treasury transfer to strategic partner
- resolved policy: `T2_medium` + `R1_standard_transfer`
- approvals: `human_owner` + `governance_reviewer`
- executor cannot be proposer or approver
- if approval sits too long and reservation expires, execution must fail with `approval_stale` or `budget_reservation_unavailable`

### example C: high-risk permission/key change
- action: rotate treasury signing key / change treasury permission set
- resolved policy: `R3_permission_or_key_change`
- approvals: 2 human approvals including `human_owner` + 1 `governance_reviewer`
- any treasury permissions pause blocks execution
- no agent may execute this action alone

## integration notes
- roadmap tracking remains in `docs/product/ROADMAP_V1.md`
- rollback/correction behavior for mistaken treasury execution should follow `docs/operations/ROLLBACK_UNDO_SEMANTICS_V1.md`
- audit storage should align with `docs/operations/AUDIT_LOG_DUAL_WRITE_V1.md`
- later runtime implementation may add validators and wallet/provider adapters, but this slice stays docs/contracts first
