# decision incident triage runbook v1

## metadata
- version: v1.0.0
- owner_role: agent_product_governance
- review_cadence: weekly
- next_review_due: 2026-03-28

## objective
Provide a deterministic first-10-minutes incident procedure for decision-path failures so operators can move from alert -> isolation -> explanation using canonical event and metric artifacts.

## scope
This slice defines:
- first-10-minutes triage checklist
- minimum queries by `correlation_id` / `decision_id`
- fault-isolation decision tree
- required incident evidence capture

This slice does **not** define:
- pager tooling
- long-form postmortem template
- automated remediation

## first 10 minutes checklist
1. acknowledge the alert and record start time
2. capture `alert_name`, `severity`, `lane`, `decision_id`, and `correlation_id`
3. determine whether the incident is:
   - stuck decision age breach
   - repeated validation failure
   - abnormal hold/no-go spike
4. pull the canonical event trail for the affected `correlation_id`
5. identify the latest emitted state transition and last `reason_code`
6. decide whether the failure source is primarily:
   - event emission gap
   - validation/admissibility failure
   - approval/policy failure
   - execution/pause/budget failure
   - metric/alert derivation drift
7. record the current containment action
8. if execution-critical and unresolved within 10 minutes, escalate with `needs-human`

## exact query contract
The observability substrate is implementation-agnostic, so the runbook defines query intent rather than a fixed backend.

Minimum required queries:
- by `correlation_id`: return all decision events in emitted order
- by `decision_id`: return lifecycle states, approvals, and terminal outcome if any
- by `lane` + time window: return counts for `validation_failed`, `artifact_missing`, `evidence_missing`, `hold`, `no_go`
- by alert window: return baseline vs current metric values for the triggered metric

Required outputs:
- ordered event trail
- latest state + age in state
- last `reason_code`
- metric delta relevant to the alert

## fault-isolation decision tree
### A. stuck decision age breach
Ask:
- is there a recent event for the same `decision_id`?
- is the decision actually progressing but events are missing?
- is the decision blocked in policy/review/pause state?

Likely source classification:
- no new event + real workflow moving -> event emission gap
- no new event + workflow also stalled -> real execution blockage
- repeated same-state events -> producer/idempotency bug

### B. repeated validation failures by lane
Ask:
- are reason codes concentrated on one artifact type?
- is the same schema/evidence step failing repeatedly?
- did a new policy/doc contract land recently?

Likely source classification:
- one broken artifact producer
- one schema contract drift
- widespread authoring/process regression

### C. hold/no-go spike vs baseline
Ask:
- is the spike localized to one lane or system-wide?
- are reasons concentrated on one failure class?
- is the baseline comparison window trustworthy?

Likely source classification:
- real governance/policy degradation
- noisy threshold configuration
- metric derivation drift

## containment guidance
- event emission gap: freeze claims of observability completeness until parity is restored
- validation failure burst: stop counting affected flows as healthy and isolate the producing artifact path
- hold/no-go spike: treat as real until disproven; do not hand-wave as dashboard noise
- pause/budget/policy failure: preserve fail-closed posture and escalate rather than bypassing controls

## incident evidence capture
Minimum evidence artifact must include:
- alert payload snapshot
- affected `decision_id` / `correlation_id`
- ordered event trail excerpt
- first identified failing boundary
- containment action taken
- current operator hypothesis
- time-to-explain (minutes from alert to plausible source classification)

## escalation threshold
Escalate immediately when any are true:
- sev2 alert remains unexplained after 10 minutes
- evidence suggests a gap between real workflow state and canonical event history
- multiple lanes are simultaneously affected
- fail-closed governance controls are being bypassed or pressured to bypass

Escalation block must include:
- blocker
- what was checked
- likely fault domain
- current containment
- recommended next action

## simulation success criterion
A simulated incident counts for v1 only if an operator can:
- identify the triggering alert
- reconstruct the event trail by stable id
- classify the most likely failure domain
- produce a short explanation within 10 minutes

## integration notes
- alert semantics come from `docs/operations/DECISION_ALERT_CONTRACT_V1.md`
- canonical transition reconstruction comes from `docs/operations/DECISION_EVENT_SCHEMA_V1.md`
- metric interpretation comes from `docs/operations/DECISION_METRIC_DICTIONARY_V1.md`
