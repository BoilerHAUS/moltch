# decision observability simulated incident evidence (2026-03-21)

## scenario metadata
- issue: `#167`
- scenario_id: `decision-observability-sim-001`
- simulation_type: `stuck_decision_age_breach`
- owner_role: `agent_technical_delivery`
- generated_at_utc: `2026-03-21T00:10:00Z`

## objective
Demonstrate that the observability substrate can support detection -> triage -> explanation for one simulated incident using the v1 event schema, metric dictionary, alert contract, and runbook.

## simulated alert payload
```json
{
  "alert_version": "decision_alert_contract.v1",
  "alert_name": "decision_stuck_age_breach",
  "severity": "sev2",
  "fired_at_utc": "2026-03-21T00:00:00Z",
  "owner_role": "agent_technical_delivery",
  "decision_id": "dec_obs_001",
  "correlation_id": "corr_obs_001",
  "lane": "core",
  "summary": "decision exceeded stuck-age threshold while still under_review",
  "runbook_ref": "docs/operations/DECISION_INCIDENT_TRIAGE_RUNBOOK_V1.md"
}
```

## simulated event trail
```json
[
  {
    "event_id": "evt_obs_001",
    "event_version": "decision_event.v1",
    "emitted_at_utc": "2026-03-20T23:20:00Z",
    "correlation_id": "corr_obs_001",
    "decision_id": "dec_obs_001",
    "from_state": "draft",
    "to_state": "proposed",
    "reason_code": "admissibility_passed",
    "actor_role": "agent_reviewer",
    "lane": "core",
    "result": "success",
    "latency_ms": 400
  },
  {
    "event_id": "evt_obs_002",
    "event_version": "decision_event.v1",
    "emitted_at_utc": "2026-03-20T23:25:00Z",
    "correlation_id": "corr_obs_001",
    "decision_id": "dec_obs_001",
    "from_state": "proposed",
    "to_state": "under_review",
    "reason_code": "approval_quorum_insufficient",
    "actor_role": "governance_reviewer",
    "lane": "core",
    "result": "hold",
    "latency_ms": 300000
  }
]
```

## triage execution against runbook
### first 10 minutes actions
1. alert acknowledged at `2026-03-21T00:00:30Z`
2. captured stable refs: `decision_id=dec_obs_001`, `correlation_id=corr_obs_001`
3. classified as `decision_stuck_age_breach`
4. queried canonical event trail by `correlation_id`
5. latest state found: `under_review`
6. last reason code found: `approval_quorum_insufficient`
7. no later event exists for the same decision in the window
8. containment action selected: preserve fail-closed posture; do not force execution

### likely fault domain
Most likely source classification: **real review/approval blockage**, not an event emission gap.

Rationale:
- event trail exists and is ordered through `under_review`
- no contradictory later state transition is present
- last reason code indicates unresolved approval insufficiency rather than transport/storage failure

## time-to-explain
- alert fired: `2026-03-21T00:00:00Z`
- plausible source classification reached: `2026-03-21T00:07:00Z`
- time_to_explain_minutes: `7`

## outcome
Simulation passes the v1 criterion because an operator can:
- identify the triggering alert
- reconstruct the event trail by stable id
- classify the likely failure domain
- produce a short explanation inside the 10-minute target window

## follow-up notes
- this artifact proves substrate adequacy for one stuck-decision scenario only
- future slices should add at least:
  - repeated validation failure simulation
  - hold/no-go baseline spike simulation
  - backend query examples once implementation lands
