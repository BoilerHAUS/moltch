# rollback and undo semantics v1

## metadata
- version: v1.0.0
- owner_role: agent_technical_delivery
- review_cadence: biweekly
- next_review_due: 2026-04-03

## objective

Define how agent actions are reversed, compensated, or corrected in a multi-agent system. Establish the contract between action execution and rollback so that agents, governance layers, and audit infrastructure share one model of what "undo" means and when it is available.

## core principle: rollback is not undo

Undo implies a magical return to prior state. Rollback is a deliberate action with its own costs, dependencies, and failure modes. This spec treats rollback as a first-class operation, not a property of the original action.

Three categories replace the single concept of "undo":

| category | meaning | example |
|---|---|---|
| **direct_revert** | preconditions can be safely re-entered; postconditions have not been consumed by downstream actions | git revert, closing an unmerged PR, deleting a draft doc |
| **compensating_action** | exact reversal is impossible or unsafe, but a corrective action can close the gap | sending a correction message after a bad notification, issuing a credit after a bad charge |
| **annotate_only** | the action is historically irreversible; the system can only record that it was wrong and why | merged PR with downstream deploys, screenshot of deleted message already circulated |

## rollback class degradation

Rollback class is not a static label. It degrades over time and consumption.

```
direct_revert ──[window expires or consumed]──▶ compensating_action ──[no compensation available]──▶ annotate_only
```

Rules:
1. rollback class may degrade but must never silently upgrade
2. degradation is triggered by: elapsed time (`rollback_window_ms` expiry), downstream consumption (`consumed_by[]` grows), or external boundary crossing
3. when degradation occurs, the action record must be updated and the change must appear in the audit log

## action record schema

Every executed action carries rollback metadata from the moment of execution.

```json
{
  "action_id": "uuid",
  "lineage_id": "uuid (shared across related actions in a chain)",
  "parent_action_id": "uuid | null",
  "action_class": "A0 | A1 | A2 | A3",
  "rollback_class": "direct_revert | compensating_action | annotate_only",
  "rollback_window_ms": "number | null (null = no time limit on revert)",
  "target_resource_ref": "string (identifies the resource acted upon)",
  "preconditions": ["list of conditions that held at execution time"],
  "postconditions": ["list of conditions that hold after execution"],
  "external_boundary": "boolean (true if action crossed a system boundary)",
  "consumed_by": ["action_ids of downstream actions that read/used postconditions"],
  "compensation_creates": ["action_ids of actions spawned by compensating this one"],
  "executed_at_utc": "ISO-8601",
  "executed_by": "agent_identity_ref",
  "rollback_class_degraded_at_utc": "ISO-8601 | null",
  "rollback_class_degradation_reason": "string | null"
}
```

### boundary classification

`external_boundary` is `true` when:
- the action calls an external API (messaging, payment, deployment)
- the action writes to shared state readable by other agents (memory files, shared config, databases)
- the action produces user-visible output (notifications, messages, UI changes)

Shared state between agents counts as a boundary crossing. An agent writing to a memory file that another agent reads is not a local action.

## rollback decision algorithm

When a rollback is requested for action A:

```
1. CHECK rollback_class of A
   ├─ annotate_only → skip to step 5
   └─ direct_revert or compensating_action → continue

2. COMPUTE impact set
   ├─ find all actions where A.action_id ∈ consumed_by
   ├─ recursively find their consumers (transitive closure)
   └─ output: full dependency tree rooted at A

3. EVALUATE revert safety
   ├─ are A's preconditions still satisfiable?
   ├─ has rollback_window_ms expired?
   ├─ is impact set empty? (safe for auto-revert)
   └─ is impact set non-empty? → require explicit approval

4. EXECUTE rollback
   ├─ depth 0 (A only, empty impact set): may auto-execute
   ├─ depth 1 (A + direct consumers): present impact set, require approval
   ├─ depth 2+ (cascade): present full tree, require governance-role approval
   └─ create rollback action record (this is itself a first-class action)

5. ANNOTATE (always, regardless of path)
   ├─ record rollback attempt in audit log
   ├─ link rollback action to original via lineage_id
   └─ if annotate_only: record correction annotation with reason
```

### rules

- **no silent rollback**: every rollback request becomes a first-class action in the audit log, whether it succeeds or not
- **no auto-unwind beyond depth 1**: cascade rollbacks require explicit approval from a governance-role agent or human
- **idempotent compensations**: retrying a failed compensation must not create fresh ambiguity; compensating actions should be idempotent where possible
- **snapshots are optional, lineage is mandatory**: state snapshots help for local rollback but do not solve external effects; lineage tracking is always required

## worked examples

### example 1: local reversible action (direct_revert)

**Scenario:** Agent creates a branch and opens a draft PR with documentation changes. No reviews, no merges, no downstream consumption.

```
action_id: a1
action_class: A0
rollback_class: direct_revert
rollback_window_ms: null
external_boundary: false
consumed_by: []
```

**Rollback request:** Author realizes the approach is wrong.

Decision path:
1. rollback_class = direct_revert ✓
2. impact set = empty (consumed_by is [])
3. preconditions satisfiable (branch exists, PR is draft) ✓
4. auto-execute: close PR, delete branch
5. audit log: record rollback action linked via lineage_id

**Result:** Clean revert. No approval required. One audit entry.

### example 2: compensating an external notification (compensating_action)

**Scenario:** Agent sends a Slack notification to a channel announcing a treasury proposal with incorrect amounts.

```
action_id: a2
action_class: A1
rollback_class: compensating_action  (was direct_revert for ~2 minutes while delete was possible)
rollback_window_ms: 120000
external_boundary: true
consumed_by: [a3 (human read and replied), a4 (bot indexed the message)]
```

**Rollback request:** Error discovered 10 minutes later.

Decision path:
1. rollback_class = compensating_action (window expired, message consumed)
2. impact set = {a3 (human reply), a4 (bot index)}
3. exact revert unsafe (humans already saw and responded to incorrect info)
4. compensating action: send correction message citing original, update bot index
5. compensation itself becomes action a5 with its own lineage_id, consumed_by tracking, and potential downstream effects

```
action_id: a5
lineage_id: (same lineage as a2)
parent_action_id: a2
rollback_class: direct_revert  (can delete correction if sent in error)
rollback_window_ms: 120000
compensation_creates: []
```

**Result:** Correction sent. Two audit entries (original + compensation). The compensation is a real action that could itself need rollback.

### example 3: time-window degradation (direct_revert → compensating_action → annotate_only)

**Scenario:** Agent opens a PR with a config change.

**Phase 1 (t=0, direct_revert):**
PR opened, no reviews. Close it.
```
rollback_class: direct_revert
consumed_by: []
```

**Phase 2 (t=2h, compensating_action):**
PR reviewed and approved. Reviewer invested time, comments reference the change. Closing the PR without explanation would lose review context.
```
rollback_class: compensating_action
consumed_by: [review_action_id]
rollback_class_degraded_at_utc: "2026-03-20T04:00:00Z"
rollback_class_degradation_reason: "consumed by review; reviewer context would be lost on silent close"
```
Compensation: close PR with explanation comment, open replacement PR referencing the original.

**Phase 3 (t=6h, annotate_only):**
PR merged, CI deployed to staging, downstream agents consumed the config change and made decisions based on it.
```
rollback_class: annotate_only
consumed_by: [review_id, merge_id, deploy_id, agent_decision_1, agent_decision_2]
rollback_class_degraded_at_utc: "2026-03-20T08:00:00Z"
rollback_class_degradation_reason: "merged and deployed; downstream agents consumed postconditions"
```
Only option: record that the config was wrong, open a new issue for the forward-fix, annotate the original action.

### example 4: shared-state contamination across agents

**Scenario:** Agent A writes analysis to a shared memory file. Agent B reads the file and uses the analysis to make a governance recommendation. Agent C votes based on B's recommendation.

```
a1: Agent A writes memory file
  rollback_class: direct_revert (initially)
  external_boundary: true (shared state)

a2: Agent B reads file, produces recommendation
  parent_action_id: null (independent, but consumed_by link exists on a1)
  consumed a1's postconditions

a3: Agent C votes based on recommendation
  consumed a2's postconditions
```

**Rollback request:** The original analysis in a1 was wrong.

Decision path:
1. a1.rollback_class = compensating_action (consumed_by = [a2])
2. impact set = {a2, a3} (transitive: a2 consumed a1, a3 consumed a2)
3. depth = 2 → requires governance-role approval
4. impact set presented:
   - a1: memory file write (can be reverted)
   - a2: recommendation based on bad data (recommendation is published, needs correction)
   - a3: vote based on bad recommendation (vote may or may not be reversible depending on governance rules)
5. governance decision required: revert a1, compensate a2 (issue correction), determine if a3 vote can be re-cast

**Result:** Three-action cascade. No auto-unwind. Human or governance agent reviews the full impact set before any execution. Each corrective step is its own tracked action.

### example 5: dependency cascade requiring explicit review

**Scenario:** Agent executes a treasury transfer (A1 action class). The transfer triggers an automated receipt notification and a ledger update.

```
a1: treasury transfer (A2 class, required approval)
  external_boundary: true
  rollback_class: compensating_action (financial actions are never direct_revert)

a2: receipt notification (triggered by a1)
  parent_action_id: a1
  external_boundary: true

a3: ledger update (triggered by a1)
  parent_action_id: a1
  external_boundary: false (internal state)
```

**Rollback request:** Transfer was to wrong address.

Decision path:
1. a1.rollback_class = compensating_action
2. impact set = {a2, a3}
3. depth = 1 but involves treasury action → governance-role approval required regardless of depth
4. compensation plan:
   - a1: issue reverse transfer (new treasury action, requires its own A2 approval flow)
   - a2: send correction notification referencing original
   - a3: reverse ledger entry
5. each compensation is a new action with full tracking

**Result:** No step executes without explicit approval. The reverse transfer goes through the same governance gate as the original. Three new action records created. Full audit trail from error to correction.

## integration points

- **audit log** (`docs/operations/AUDIT_LOG_DUAL_WRITE_V1.md`): rollback actions are dual-written like any other action. The `lineage_id` field links rollback entries to originals.
- **policy engine** (`docs/ARCHITECTURE.md`, policy-engine seam): rollback requests for A2/A3 actions must pass through policy evaluation. The `action_class` of the rollback itself determines the approval threshold.
- **state machine** (`docs/contracts/POLICY_DECISION_STATE_MACHINE_V1.md`): action lifecycle states expand to include `reverted` and `compensated` as terminal states alongside `executed`.

## action lifecycle (extended)

```
proposed → approved → executed → [reverted | compensated | superseded]
                                      ↓
                               annotated (when technical reversal is impossible)
```

States:
- **reverted**: action was directly reversed; preconditions re-established
- **compensated**: corrective action issued; original postconditions partially or fully offset
- **superseded**: a newer action replaces this one (forward-fix pattern)
- **annotated**: action is historically recorded as incorrect but cannot be technically reversed

## open questions for v2

1. should rollback_window_ms be configurable per action_class, or always per-action?
2. should the system support "tentative execution" where actions are held in a revertible state for a mandatory window before becoming permanent?
3. how does rollback interact with on-chain enforcement when the policy engine moves on-chain?
4. should consumed_by tracking be push (action declares what it consumed) or pull (system infers from resource access logs)?
