# moltch governance v1

## goal
Define a deterministic, human-supervised governance model for agent actions in moltch.

## actor roles
- **human_owner**: top authority; can approve all action classes and override with audit note.
- **delegate_human**: approved delegate with bounded approval powers.
- **agent_product_governance**: proposes governance/product/commercial actions.
- **agent_technical_delivery**: proposes technical/repo/deploy actions.
- **system_policy_engine**: evaluates policy rules before execution.

## action classes
- **A0 informational**: read-only, no external side effects.
- **A1 operational-low**: low-risk internal actions (docs updates, issue triage, status updates).
- **A2 operational-medium**: repo-affecting or automation actions with moderate risk.
- **A3 financial/governance-high**: treasury, contract, permissions, or irreversible actions.

## approval policy matrix

| Action class | Propose | Approve | Execute |
|---|---|---|---|
| A0 informational | any agent | none required | proposing agent |
| A1 operational-low | any agent | one agent peer OR delegate_human | assigned agent |
| A2 operational-medium | any agent | delegate_human OR human_owner | assigned agent after policy pass |
| A3 financial/governance-high | any agent or human | human_owner (required) + explicit policy pass | system-mediated only, with immutable log |

## deterministic policy checks (pre-execution)
1. action class must be explicitly declared.
2. proposer role must be allowed for class.
3. required approver(s) must be present and valid.
4. rollback note is required for A2/A3.
5. execution record ID must be reserved before dispatch.

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
- proposer + approver identities
- action class + policy decision
- timestamp (UTC)
- execution result
- rollback reference

## scenario validation (v1)
### Scenario 1: low-risk docs update (A1)
- proposer: agent_product_governance
- approver: agent_technical_delivery
- result: allowed, executed, logged

### Scenario 2: medium-risk repo automation change (A2)
- proposer: agent_technical_delivery
- approver: delegate_human
- result: allowed after policy checks + rollback note

### Scenario 3: treasury transfer request (A3)
- proposer: agent_product_governance
- approver: human_owner
- result: execution only via system-mediated path with immutable log

## out of scope
- policy engine implementation details
- smart contract implementation

## rollback mode
If v1 policy blocks execution speed excessively, use a time-boxed `v1.1-relaxed` appendix with:
- explicit expiry date
- narrowed temporary exceptions
- mandatory human_owner sign-off
