# oracle bridge approval surface v1

## implemented now
This first on-chain slice implements a narrow executable approval surface for the existing oracle-bridge seam:
- bridge request registration
- explicit transition to approval-pending
- approval / denial decision recording
- execution start + terminal execution outcome recording
- stable canonical events for request, approval, and execution transitions
- deterministic replay protection on `executionId`
- explicit invalid-transition rejection

## deliberately deferred to follow-on work
This first PR does **not** yet implement:
- timeout / retry state handling
- reconciliation transitions after denial/execution terminal states
- bridge transport/economic semantics
- attestation registry enforcement
- proxy upgrade framework

## upgrade stance
- v1 stance: **immutable prototype**
- expected evolution path: versioned replacement deployment once timeout/retry/reconciliation behavior is proven useful enough to stabilize

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
- required fields must be non-zero on request / decision / execution calls
- duplicate `bridgeRequestId` registration is rejected
- invalid lifecycle transitions are rejected through explicit allowed-edge checks
- duplicate `executionId` recording is rejected
- unknown bridge request lookup or mutation is rejected

## asserted in conformance tests for this slice
- deterministic happy-path request -> approval -> execution
- deterministic denial path
- stable invalid-transition failure mode
- explicit `executionId` replay rejection
