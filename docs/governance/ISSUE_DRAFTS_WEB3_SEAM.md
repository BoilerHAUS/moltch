# issue drafts: web3 enforcement seam

These are ready-to-post GitHub issues. Copy each block as-is.

---

## Issue 1

**Title:** `[arch] Define stable interface for policy-engine to support future on-chain implementation`

**Labels:** `architecture`, `packages`, `A1-operational-low`

```markdown
## Context

During a governance architecture review, it was identified that `packages/policy-engine`
is the primary enforcement layer for action class decisions (A0–A3).

The 9 deterministic pre-execution checks in `docs/governance/GOVERNANCE_V1.md` are the
logical equivalent of smart contract `require()` guards. As the project moves toward web3
integration post-v1, an on-chain implementation of the same logic should be a drop-in
replacement for the current off-chain engine.

To protect this seam without additional build complexity, the interface between
`services/api` and `packages/policy-engine` should be explicitly documented and stable
before implementation hardens further.

## Action required

1. Review how `services/api` currently calls `packages/policy-engine`
2. Define and document a stable interface (input/output contract) for policy evaluation:
   - Input: action class, proposer role, approver role(s), timestamps, idempotency key, request hash
   - Output: `allow | deny | blocked_needs_human` + reason code
3. Add a note to `docs/ARCHITECTURE.md` naming this interface as the future seam for on-chain enforcement
4. No implementation change required — interface documentation only

## Why now

Costs nothing to document before implementation hardens. Costly to retrofit once
`services/api` has direct coupling to implementation details of the current engine.

## Acceptance criteria

- [ ] Interface contract documented (inline in `packages/policy-engine` or in `docs/ARCHITECTURE.md`)
- [ ] `services/api` calls match the documented interface
- [ ] `docs/ARCHITECTURE.md` includes a note referencing the on-chain seam

## Action class
A1 — operational-low (docs + interface spec, no external side effects)

## Owner lane
agent_technical_delivery
```

---

## Issue 2

**Title:** `[roadmap] Add deferred item: on-chain policy enforcement and audit log (post-v1)`

**Labels:** `roadmap`, `governance`, `web3`, `deferred`, `A1-operational-low`

```markdown
## Context

The moltch governance model (`docs/governance/GOVERNANCE_V1.md`) is structurally
compatible with smart contract enforcement:

- Action classes A0–A3 → function selectors / access control
- 9 deterministic pre-execution checks → `require()` guards
- Decision log schema → on-chain event emission
- Approval windows → block timestamp constraints
- Idempotency keys + request hashes → on-chain deduplication

`docs/product/PRD_V1_BOUNDARY.md` already correctly defers "onchain treasury execution"
as a v1 non-goal. This issue extends that thinking to the full enforcement and audit layer.

## Action required

Add the following deferred items to `docs/product/ROADMAP_V1.md` under a new
`v2 (deferred, web3)` section:

```
### v2 / web3 layer (deferred post-v1 launch)
- [ ] packages/contracts — on-chain implementation of policy-engine interface
- [ ] packages/audit-log dual-write — emit decision log entries as on-chain events
- [ ] Agent identity layer — signing keys / attestations for agent actors
- [ ] Oracle bridge — off-chain executor requests on-chain approval, reports result
- [ ] AI Contract Factory — generalised contract templates for agent interaction covenants
```

Also update `docs/ARCHITECTURE.md` to add a single line under the security baseline:
> On-chain enforcement is the target state for A2/A3 policy evaluation.
> The `policy-engine` interface is the designated seam.

## Why now

Deferral decisions are only useful if they're recorded. Without a roadmap entry, this
surfaces again as an unstructured conversation rather than a tracked decision.

## Acceptance criteria

- [ ] `docs/product/ROADMAP_V1.md` includes a `v2 / web3 layer` section with items above
- [ ] `docs/ARCHITECTURE.md` includes the seam note
- [ ] No implementation work in this issue — docs only

## Action class
A1 — operational-low (docs update)

## Owner lane
agent_product_governance
```
