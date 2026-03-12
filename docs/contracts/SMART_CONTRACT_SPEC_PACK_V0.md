# Smart Contract Spec Pack V0

Issue: #86  
Status: Draft for implementation targeting Claude Code + invariant-driven audit

## Objective
Define an authoritative, implementation-ready contract spec for v2/deferred web3 enforcement, with auditability grounded in covenant invariants (not style opinions).

## Ordering Rule (must follow)
1. Define covenant invariants first (`boilerclaw` / `boilermolt` trust boundaries).
2. Derive function surface + errors from those invariants.
3. Lock storage layout + events only after (1) and (2).

## Normalized Modules
1. PolicyEngine
2. ApprovalRegistryTopology
3. RequestLedger
4. DecisionLog
5. AgentIdentityCovenantRegistry

---

## Cross-Cutting Requirements (apply to every module)
- **Invariants**: safety and trust-boundary properties that must never be violated.
- **Function surface + access control**: callable methods, caller roles, preconditions.
- **Storage layout assumptions**: key structs/mappings and immutability expectations.
- **Events + indexed fields**: canonical names and index strategy for audit/replay.
- **Revert/error taxonomy**: stable custom errors and reason code mapping.
- **Upgradeability stance**: immutable/proxy/migration approach and constraints.
- **Negative-case catalog**: required deny/revert scenarios for test coverage.
- **Traceability matrix coverage**: each invariant mapped to functions, events, and tests.

---

## Canonical Decision Result + Reason Code Conventions
Decision enum:
- `ALLOW`
- `DENY`
- `BLOCKED_NEEDS_HUMAN`

Reason code naming:
- Prefix by module (`PE_`, `AR_`, `RL_`, `DL_`, `AI_`)
- Use uppercase snake case (`PE_ROLE_MISMATCH`, `RL_DUPLICATE_REQUEST_HASH`)
- One semantic reason per code; never overload
- Off-chain docs and on-chain errors/events must use the same semantic labels

Event naming:
- Past-tense domain event names (`DecisionEvaluated`, `ApprovalRecorded`, `RequestRejected`)
- Include `requestHash` when applicable
- Include `reasonCode` for all deny/block outcomes

---

## Module Specs

## 1) PolicyEngine
### Purpose
Evaluate A0–A3 actions against deterministic guard checks and return canonical decision outcomes.

### Invariants
- I-PE-01: No action may return `ALLOW` if required approval topology is unmet.
- I-PE-02: Role boundary violations must never produce `ALLOW`.
- I-PE-03: Duplicate request hash/idempotency key must never produce a new `ALLOW` decision.

### Function Surface + Access Control
- `evaluateAction(ActionRequest req) returns (DecisionResult result, bytes32 reasonCode)`
  - Caller: authorized execution service/router
- `setPolicyVersion(bytes32 version)`
  - Caller: governance/admin role (if mutable policy versions are allowed)

### Storage Layout Assumptions
- Active policy version ref
- Guard configuration snapshot by version

### Events
- `DecisionEvaluated(bytes32 indexed requestHash, uint8 actionClass, uint8 result, bytes32 reasonCode, address evaluator)`

### Revert/Error Taxonomy
- `error PE_UNAUTHORIZED_EVALUATOR();`
- `error PE_INVALID_ACTION_CLASS();`
- `error PE_POLICY_VERSION_NOT_FOUND();`

### Upgradeability Stance
- Logic may be upgradeable only if invariant compatibility is proven and migration checklist passes.

### Negative-Case Catalog
- N-PE-01: Unauthorized evaluator call → revert `PE_UNAUTHORIZED_EVALUATOR`
- N-PE-02: Invalid action class → revert `PE_INVALID_ACTION_CLASS`
- N-PE-03: Missing mandatory approver for A2/A3 → `DENY` with mapped reason code

---

## 2) ApprovalRegistryTopology
### Purpose
Encode approver role constraints and threshold/topology rules per action class.

### Invariants
- I-AR-01: Approval thresholds for each action class are enforced deterministically.
- I-AR-02: Approvals outside assigned role topology are invalid.

### Function Surface + Access Control
- `recordApproval(bytes32 requestHash, address approver, bytes32 role)`
- `isTopologySatisfied(bytes32 requestHash, uint8 actionClass) returns (bool)`

### Storage Layout Assumptions
- Request → approvals set
- ActionClass → topology config

### Events
- `ApprovalRecorded(bytes32 indexed requestHash, address indexed approver, bytes32 role)`
- `TopologyConfigured(uint8 indexed actionClass, bytes32 topologyHash)`

### Revert/Error Taxonomy
- `error AR_UNAUTHORIZED_APPROVER();`
- `error AR_DUPLICATE_APPROVAL();`
- `error AR_TOPOLOGY_NOT_CONFIGURED();`

### Upgradeability Stance
- Topology config mutable; approval records immutable after decision finalization.

### Negative-Case Catalog
- N-AR-01: Duplicate approval by same actor → `AR_DUPLICATE_APPROVAL`
- N-AR-02: Approval from disallowed role → `AR_UNAUTHORIZED_APPROVER`

---

## 3) RequestLedger
### Purpose
Guarantee idempotency and replay protection for decision/execution requests.

### Invariants
- I-RL-01: Each request hash may be consumed once under terminal decision semantics.
- I-RL-02: Replays cannot alter prior terminal outcome.

### Function Surface + Access Control
- `registerRequest(bytes32 requestHash, bytes32 idempotencyKey)`
- `markTerminal(bytes32 requestHash, uint8 result)`
- `isDuplicate(bytes32 requestHash, bytes32 idempotencyKey) returns (bool)`

### Storage Layout Assumptions
- requestHash → status/result
- idempotencyKey → requestHash binding

### Events
- `RequestRegistered(bytes32 indexed requestHash, bytes32 indexed idempotencyKey)`
- `RequestFinalized(bytes32 indexed requestHash, uint8 result)`

### Revert/Error Taxonomy
- `error RL_DUPLICATE_REQUEST_HASH();`
- `error RL_IDEMPOTENCY_KEY_CONFLICT();`

### Upgradeability Stance
- Ledger entries immutable once finalized.

### Negative-Case Catalog
- N-RL-01: same requestHash re-register attempt → `RL_DUPLICATE_REQUEST_HASH`
- N-RL-02: idempotencyKey bound to different hash → `RL_IDEMPOTENCY_KEY_CONFLICT`

---

## 4) DecisionLog
### Purpose
Emit canonical on-chain audit events for governance decisions and outcome transitions.

### Invariants
- I-DL-01: Every terminal decision emits exactly one canonical terminal event.
- I-DL-02: Deny/block decisions must include reason code.

### Function Surface + Access Control
- `emitDecision(...)`
- `emitExecutionStatus(...)`

### Storage Layout Assumptions
- Event-only preferred; avoid mutable storage unless required for indexing support.

### Events
- `DecisionLogged(bytes32 indexed requestHash, uint8 actionClass, uint8 result, bytes32 reasonCode)`
- `ExecutionStatusLogged(bytes32 indexed requestHash, uint8 status, bytes32 detailCode)`

### Revert/Error Taxonomy
- `error DL_INVALID_RESULT_TRANSITION();`

### Upgradeability Stance
- Event schema versioning required for any breaking changes.

### Negative-Case Catalog
- N-DL-01: terminal event emitted twice for same request → revert `DL_INVALID_RESULT_TRANSITION`

---

## 5) AgentIdentityCovenantRegistry
### Purpose
Bind agent identities to roles/lanes and encode cross-agent covenant constraints.

### Invariants
- I-AI-01: Role bindings are explicit and verifiable; unknown actors cannot assume privileged roles.
- I-AI-02: Covenant constraints between designated agents are enforceable as hard rules.

### Function Surface + Access Control
- `registerAgent(address agent, bytes32 role, bytes32 lane)`
- `setCovenantConstraint(bytes32 constraintId, bytes calldata data)`
- `isActorAuthorized(address actor, bytes32 role) returns (bool)`

### Storage Layout Assumptions
- actor → role/lane binding
- covenant constraint registry by id/version

### Events
- `AgentRegistered(address indexed agent, bytes32 role, bytes32 lane)`
- `CovenantConstraintSet(bytes32 indexed constraintId, bytes32 version)`

### Revert/Error Taxonomy
- `error AI_ROLE_BINDING_REQUIRED();`
- `error AI_COVENANT_CONSTRAINT_VIOLATION();`

### Upgradeability Stance
- Role history must remain auditable across upgrades.

### Negative-Case Catalog
- N-AI-01: unregistered actor attempts privileged action → `AI_ROLE_BINDING_REQUIRED`
- N-AI-02: action breaches covenant rule → `AI_COVENANT_CONSTRAINT_VIOLATION`

---

## Traceability Matrix (starter)
| Invariant ID | Enforcing Function(s) | Evidence Event(s) | Required Test IDs |
|---|---|---|---|
| I-PE-01 | `PolicyEngine.evaluateAction` + `ApprovalRegistryTopology.isTopologySatisfied` | `DecisionEvaluated` | T-PE-001, T-AR-004 |
| I-PE-02 | `PolicyEngine.evaluateAction`, `AgentIdentityCovenantRegistry.isActorAuthorized` | `DecisionEvaluated` | T-PE-002, T-AI-003 |
| I-PE-03 | `RequestLedger.registerRequest`, `RequestLedger.markTerminal` | `RequestRegistered`, `RequestFinalized` | T-RL-001, T-PE-005 |
| I-AR-01 | `ApprovalRegistryTopology.recordApproval`, `isTopologySatisfied` | `ApprovalRecorded` | T-AR-001, T-AR-002 |
| I-DL-02 | `DecisionLog.emitDecision` | `DecisionLogged` | T-DL-003 |
| I-AI-02 | `AgentIdentityCovenantRegistry.setCovenantConstraint` + policy checks | `CovenantConstraintSet`, `DecisionEvaluated` | T-AI-004, T-PE-006 |

> Expand this matrix as implementation proceeds; no contract PR is complete without full invariant coverage rows.

---

## Audit Checklist (for Claude PR review)
- [ ] Every function references one or more invariant IDs.
- [ ] Every invariant has at least one failing negative test.
- [ ] Every deny/block path emits or returns canonical reason code.
- [ ] Event schema and reason code naming follow this pack exactly.
- [ ] Replay/idempotency behavior is proven with tests.
- [ ] Access control for privileged functions is explicit and tested.
- [ ] Upgradeability assumptions documented and enforced in code comments/tests.
