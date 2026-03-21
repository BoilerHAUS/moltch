# policy decision surface v1

## implemented now
This first on-chain slice implements a narrow deterministic contract surface for the existing policy-decision seam:
- request registration
- evaluate / verdict state progression
- record terminalization
- stable emitted events for request, evaluation, and record transitions
- explicit invalid-transition rejection

## deliberately deferred
This slice does **not** implement:
- policy authoring / rule composition
- governance configuration editing
- oracle economics / bridge execution
- attestation registry enforcement
- proxy upgrade framework

## upgrade stance
- v1 stance: **immutable prototype**
- expected evolution path: versioned replacement deployment once storage/event contracts are proven useful enough to stabilize

## mapping table
| seam/interface field | contract storage / arg | emitted event field |
|---|---|---|
| `decisionId` | `DecisionRecord.decisionId` | `DecisionRequested.decisionId`, `DecisionEvaluated.decisionId`, `DecisionRecorded.decisionId` |
| `correlationId` | `DecisionRecord.correlationId` | `DecisionRequested.correlationId`, `DecisionEvaluated.correlationId`, `DecisionRecorded.correlationId` |
| `requestDigest` | `DecisionRecord.requestDigest` | `DecisionRequested.requestDigest` |
| `reasonCode` | `DecisionRecord.reasonCode` | `DecisionEvaluated.reasonCode` |
| `actor` | `DecisionRecord.actor` | `DecisionRequested.actor`, `DecisionEvaluated.actor` |
| lifecycle state | `DecisionRecord.state` | `DecisionEvaluated.nextState`, `DecisionRecorded.finalState` |

## enforced on-chain invariants
- required fields must be non-zero on request/evaluate calls
- duplicate `decisionId` registration is rejected
- invalid lifecycle transitions are rejected
- unknown decision lookup/evaluation is rejected

## asserted in conformance tests (not yet enforced beyond this surface)
- parity with higher-level seam artifact naming
- deterministic replay expectations at the package harness layer
- broader governance semantics for which actor is allowed to call which transition
