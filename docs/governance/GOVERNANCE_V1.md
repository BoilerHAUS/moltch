# moltch governance v1

## governance metadata
- **version:** v1.0.1
- **effective_date:** 2026-03-08
- **owner:** boilermolt (product/governance/docs)
- **review_cadence:** biweekly
- **next_review_due:** 2026-03-22

## goal
Define a deterministic, human-supervised governance model for agent actions in moltch.

## actor roles
- **human_owner**: top authority; can approve all action classes and override with audit note.
- **delegate_human**: approved delegate with bounded approval powers.
- **agent_product_governance**: proposes governance/product/commercial/doc actions.
- **agent_technical_delivery**: proposes technical/repo/deploy actions.
- **system_policy_engine**: evaluates policy rules before execution.

## identity and auth source of truth
- Role identity is derived from the policy registry + mapped GitHub actor identity.
- Every proposer/approver/executor must resolve to a verified role at decision time.
- If identity cannot be verified, action state fails closed -> `blocked_needs_human`.

## action classes
- **A0 informational**: read-only, no external side effects.
- **A1 operational-low**: low-risk internal actions (docs updates, issue triage, status updates).
- **A2 operational-medium**: repo-affecting or automation actions with moderate risk.
- **A3 financial/governance-high**: treasury, contract, permissions, or irreversible actions.

## separation-of-duties rules
- no self-approval for A1-A3.
- proposer cannot be approver for A1-A3.
- for A2/A3, approver cannot be executor unless explicitly approved by human_owner with audit note.
- **peer** for A1 means a different non-system actor with a different role than proposer.

## approval policy matrix

| Action class | Propose | Approve | Execute |
|---|---|---|---|
| A0 informational | any verified agent | none required | proposing agent |
| A1 operational-low | any verified agent | one verified peer OR delegate_human | assigned agent |
| A2 operational-medium | any verified agent | delegate_human OR human_owner | assigned agent after policy pass |
| A3 financial/governance-high | any verified agent or human | human_owner (required) + explicit policy pass | system-mediated only, with immutable log |

## deterministic policy checks (pre-execution)
1. action class must be explicitly declared.
2. proposer role must be allowed for class.
3. required approver(s) must be present and valid.
4. separation-of-duties checks must pass.
5. rollback plan is required for A2/A3 and must include owner, ordered steps, and max rollback window.
6. idempotency key + request hash must be present and unique for non-A0 actions.
7. approval must be within valid approval window (not stale).
8. execution record ID must be reserved before dispatch.

If any check fails: action state -> `blocked_needs_human`.

## escalation and exception handling (`needs-human`)
When blocked >15 minutes, post in standard format:
1. blocker
2. what was tried
3. options (2-3)
4. recommended option
5. `needs-human`

## auditable log requirements
Every A1-A3 action must persist:
- proposer + approver + executor identities
- action class + policy decision
- idempotency key + request hash
- timestamp (UTC)
- execution result
- rollback reference

### minimal decision log schema
```json
{
  "event_id": "evt_20260308_0001",
  "action_id": "act_20260308_0001",
  "action_class": "A2",
  "proposer": "agent_technical_delivery",
  "approver": "delegate_human",
  "executor": "agent_technical_delivery",
  "policy_decision": "allow",
  "idempotency_key": "a2-ops-20260308-01",
  "request_hash": "sha256:...",
  "ts_utc": "2026-03-08T10:10:00Z",
  "result": "executed",
  "rollback_ref": "rb_20260308_01"
}
```

## scenario validation (v1)
### Scenario 1: low-risk docs update (A1)
- proposer: agent_product_governance
- approver: agent_technical_delivery
- result: allowed, executed, logged

### Scenario 2: medium-risk repo automation change (A2)
- proposer: agent_technical_delivery
- approver: delegate_human
- result: allowed after policy checks + rollback plan quality bar

### Scenario 3: treasury transfer request (A3)
- proposer: agent_product_governance
- approver: human_owner
- result: execution only via system-mediated path with immutable log

### Scenario 4 (denied): A2 request missing rollback quality bar
- proposer: agent_technical_delivery
- approver: delegate_human
- input: rollback note missing owner + max rollback window
- result: denied (`blocked_needs_human`), no execution dispatched

## out of scope
- policy engine implementation details
- smart contract implementation

## rollback mode
If v1 policy blocks execution speed excessively, use a time-boxed `v1.1-relaxed` appendix with:
- explicit expiry date
- narrowed temporary exceptions
- mandatory human_owner sign-off
