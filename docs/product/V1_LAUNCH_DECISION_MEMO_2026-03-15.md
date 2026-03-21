# v1 launch decision memo (2026-03-15)

## metadata
- version: v1.0.0
- owner_role: agent_product_governance
- review_cadence: weekly
- next_review_due: 2026-03-22

## objective
Refresh launch decision posture after quality-hardening merges and provide a single decision artifact with explicit verdict, reason codes, and counterfactuals.

## decision
**hold (controlled)**

## reason codes
- LAUNCH_CONTRACTS_HARDENED
- ROADMAP_GUARDRAILS_ENFORCED
- EVIDENCE_INDEX_PRESENT
- FINAL_APPROVER_SIGNOFF_PENDING

## rationale
- Core launch-gate contract quality has been hardened and merged (schema semantics, fixture coverage, dedicated contract CI signal).
- Evidence navigation/signoff ergonomics are improved via canonical evidence index and runbook entrypoint.
- Governance decision quality now has stronger traceability to deterministic evidence artifacts.
- Final release decision should remain **hold** until explicit human approver signoff is recorded against the refreshed evidence set.

## counterfactuals (what would flip the decision)
### hold -> go
All of the following become true in the same review window:
1. launch evidence checklist in `docs/operations/evidence/LAUNCH_EVIDENCE_INDEX_2026-03.md` is resolved or explicitly risk-accepted,
2. latest packet + runtime readiness artifacts are refreshed on current `main`,
3. final approver signoff is recorded in the release decision thread.

### hold -> no-go
Any of the following occurs:
1. launch-gate contract CI (`launch-gate-contracts`) or baseline gate fails on release candidate,
2. readiness/risk evidence regresses to fail state,
3. required evidence integrity/traceability is broken or stale beyond accepted bounds.

## traceability links (current merged state)
- launch evidence index: `docs/operations/evidence/LAUNCH_EVIDENCE_INDEX_2026-03.md`
- launch-readiness packet: `docs/operations/evidence/launch-readiness/2026-03-14-dry-run/launch_readiness_packet.md`
- policy conformance summary: `docs/governance/evidence/POLICY_DECISION_CONFORMANCE_SUMMARY_2026-03-14.md`
- runbook: `docs/operations/RUNBOOK_V1.md`

### key merged PRs in this hardening window
- #138 full JSON Schema validator semantics: https://github.com/BoilerHAUS/moltch/pull/138
- #139 roadmap drift guardrails + reconciliation: https://github.com/BoilerHAUS/moltch/pull/139
- #140 canonical launch evidence index: https://github.com/BoilerHAUS/moltch/pull/144
- #141 roadmap row generator helper: https://github.com/BoilerHAUS/moltch/pull/145
- #142 dedicated launch-gate contracts workflow: https://github.com/BoilerHAUS/moltch/pull/146

## next action
- Use this memo + evidence index as the decision packet for final go/hold/no-go human signoff.
