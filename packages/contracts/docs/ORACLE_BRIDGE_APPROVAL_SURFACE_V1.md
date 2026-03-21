# oracle bridge approval surface v1

## implemented now
This follow-on slice extends the executable oracle-bridge approval surface with the deferred lifecycle depth from PR A:
- bridge request registration
- explicit transition to approval-pending
- approval / denial decision recording
- execution start + terminal execution outcome recording
- timeout recording from approval-pending, approved, or executing states
- retry path from timed-out back to approval-pending
- reconciliation transitions after denial, executed, execution-failed, or timed-out states
- stable canonical events for request, approval, execution, timeout, retry, and reconciliation transitions
- deterministic replay protection on `executionId`
- explicit invalid-transition rejection, including after reconciliation terminalization

## still deliberately deferred
This PR still does **not** yet implement:
- bridge transport/economic semantics
- attestation registry enforcement
- proxy upgrade framework

## upgrade stance
- v1 stance: **immutable prototype**
- expected evolution path: versioned replacement deployment once the broader oracle-bridge semantics are proven useful enough to stabilize

## mapping table
| seam/interface field | contract storage / arg | emitted event field |
|---|---|---|
| `bridgeRequestId` | `BridgeRecord.bridgeRequestId` | `BridgeRequested.bridgeRequestId`, `BridgeApprovalRecorded.bridgeRequestId`, `BridgeExecutionRecorded.bridgeRequestId` |
| `correlationId` | `BridgeRecord.correlationId` | `BridgeRequested.correlationId` |
| `decisionId` | `BridgeRecord.decisionId` | `BridgeRequested.decisionId` |
| `approvalId` | `BridgeRecord.approvalId` | `BridgeApprovalRecorded.approvalId` |
| `executionId` | `BridgeRecord.executionId` | `BridgeExecutionRecorded.executionId` |
| `actor` | `BridgeRecord.actor` | `BridgeRequested.actor`, `BridgeApprovalRecorded.actor`, `BridgeExecutionRecorded.actor` |
| `reasonCode` | `BridgeRecord.reasonCode` | `BridgeApprovalRecorded.reasonCode`, `BridgeExecutionRecorded.reasonCode` |
| lifecycle state | `BridgeRecord.state` | `BridgeApprovalRecorded.nextState`, `BridgeExecutionRecorded.nextState` |

## enforced on-chain invariants
- required fields must be non-zero on request / decision / execution / timeout / reconciliation calls
- duplicate `bridgeRequestId` registration is rejected
- invalid lifecycle transitions are rejected through explicit allowed-edge checks
- duplicate `executionId` recording is rejected
- reconciled records reject further state movement
- unknown bridge request lookup or mutation is rejected

## asserted in conformance tests for this slice
- deterministic happy-path request -> approval -> execution
- deterministic denial -> reconciliation path
- deterministic timeout -> retry path
- deterministic execution-failed -> reconciliation path
- stable invalid-transition failure mode
- explicit `executionId` replay rejection
- reconciled terminal-state rejection
