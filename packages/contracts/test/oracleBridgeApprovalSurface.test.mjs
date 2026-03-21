import test from "node:test";
import assert from "node:assert/strict";
import {
  createOracleBridgePrototypeRuntime,
  loadOracleBridgeApprovalSurfaceSource,
  validateOracleBridgeApprovalSurfaceSource,
  OracleBridgeLifecycleState
} from "../src/oracleBridgeContractPrototype.mjs";

test("solidity oracle bridge prototype source exposes the expected contract/events/errors", () => {
  const source = loadOracleBridgeApprovalSurfaceSource();
  assert.equal(validateOracleBridgeApprovalSurfaceSource(source), true);
});

test("happy path bridge request -> approval -> execution is deterministic", () => {
  const runtime = createOracleBridgePrototypeRuntime();
  runtime.submitBridgeRequest({
    bridgeRequestId: "bridge-1",
    correlationId: "corr-1",
    decisionId: "dec-1",
    actor: "operator"
  });
  runtime.recordApprovalPending({ bridgeRequestId: "bridge-1", actor: "approver-queue" });
  runtime.recordApprovalDecision({
    bridgeRequestId: "bridge-1",
    approvalId: "approval-1",
    reasonCode: "ready_to_bridge",
    actor: "approver",
    nextState: OracleBridgeLifecycleState.Approved
  });
  runtime.beginExecution({ bridgeRequestId: "bridge-1", actor: "executor" });
  runtime.recordExecutionOutcome({
    bridgeRequestId: "bridge-1",
    executionId: "exec-1",
    reasonCode: "executed",
    actor: "executor",
    nextState: OracleBridgeLifecycleState.Executed
  });

  const record = runtime.getBridgeRecord("bridge-1");
  assert.equal(record.state, OracleBridgeLifecycleState.Executed);
  assert.equal(record.approvalId, "approval-1");
  assert.equal(record.executionId, "exec-1");
  assert.equal(
    runtime.events.map((event) => event.type).join(","),
    "BridgeRequested,BridgeApprovalRecorded,BridgeApprovalRecorded,BridgeExecutionRecorded,BridgeExecutionRecorded"
  );
});

test("denial path can be reconciled deterministically", () => {
  const runtime = createOracleBridgePrototypeRuntime();
  runtime.submitBridgeRequest({
    bridgeRequestId: "bridge-denied",
    correlationId: "corr-denied",
    decisionId: "dec-denied",
    actor: "operator"
  });
  runtime.recordApprovalPending({ bridgeRequestId: "bridge-denied", actor: "approver-queue" });
  runtime.recordApprovalDecision({
    bridgeRequestId: "bridge-denied",
    approvalId: "approval-denied",
    reasonCode: "permission_denied",
    actor: "approver",
    nextState: OracleBridgeLifecycleState.Denied
  });
  runtime.reconcile({ bridgeRequestId: "bridge-denied", reasonCode: "reconciled_after_denial", actor: "reconciler" });

  const record = runtime.getBridgeRecord("bridge-denied");
  assert.equal(record.state, OracleBridgeLifecycleState.Reconciled);
});

test("invalid transition is rejected with stable failure mode", () => {
  const runtime = createOracleBridgePrototypeRuntime();
  runtime.submitBridgeRequest({
    bridgeRequestId: "bridge-bad",
    correlationId: "corr-bad",
    decisionId: "dec-bad",
    actor: "operator"
  });

  assert.throws(
    () => runtime.recordApprovalDecision({
      bridgeRequestId: "bridge-bad",
      approvalId: "approval-bad",
      reasonCode: "permission_denied",
      actor: "approver",
      nextState: OracleBridgeLifecycleState.Denied
    }),
    /ERR_INVALID_BRIDGE_TRANSITION/
  );
});

test("duplicate execution id is rejected deterministically", () => {
  const runtime = createOracleBridgePrototypeRuntime();
  runtime.submitBridgeRequest({
    bridgeRequestId: "bridge-dup",
    correlationId: "corr-dup",
    decisionId: "dec-dup",
    actor: "operator"
  });
  runtime.recordApprovalPending({ bridgeRequestId: "bridge-dup", actor: "approver-queue" });
  runtime.recordApprovalDecision({
    bridgeRequestId: "bridge-dup",
    approvalId: "approval-dup",
    reasonCode: "ready_to_bridge",
    actor: "approver",
    nextState: OracleBridgeLifecycleState.Approved
  });
  runtime.beginExecution({ bridgeRequestId: "bridge-dup", actor: "executor" });
  runtime.recordExecutionOutcome({
    bridgeRequestId: "bridge-dup",
    executionId: "exec-dup",
    reasonCode: "executed",
    actor: "executor",
    nextState: OracleBridgeLifecycleState.Executed
  });

  assert.throws(
    () => runtime.recordExecutionOutcome({
      bridgeRequestId: "bridge-dup",
      executionId: "exec-dup",
      reasonCode: "executed",
      actor: "executor",
      nextState: OracleBridgeLifecycleState.Executed
    }),
    /ERR_EXECUTION_ALREADY_RECORDED/
  );
});

test("timeout can retry back into approval_pending deterministically", () => {
  const runtime = createOracleBridgePrototypeRuntime();
  runtime.submitBridgeRequest({
    bridgeRequestId: "bridge-timeout-retry",
    correlationId: "corr-timeout-retry",
    decisionId: "dec-timeout-retry",
    actor: "operator"
  });
  runtime.recordApprovalPending({ bridgeRequestId: "bridge-timeout-retry", actor: "approver-queue" });
  runtime.recordTimeout({ bridgeRequestId: "bridge-timeout-retry", reasonCode: "approval_stale", actor: "watchdog" });
  runtime.retryApproval({ bridgeRequestId: "bridge-timeout-retry", actor: "watchdog" });

  const record = runtime.getBridgeRecord("bridge-timeout-retry");
  assert.equal(record.state, OracleBridgeLifecycleState.ApprovalPending);
});

test("execution failure can be reconciled deterministically", () => {
  const runtime = createOracleBridgePrototypeRuntime();
  runtime.submitBridgeRequest({
    bridgeRequestId: "bridge-failed",
    correlationId: "corr-failed",
    decisionId: "dec-failed",
    actor: "operator"
  });
  runtime.recordApprovalPending({ bridgeRequestId: "bridge-failed", actor: "approver-queue" });
  runtime.recordApprovalDecision({
    bridgeRequestId: "bridge-failed",
    approvalId: "approval-failed",
    reasonCode: "ready_to_bridge",
    actor: "approver",
    nextState: OracleBridgeLifecycleState.Approved
  });
  runtime.beginExecution({ bridgeRequestId: "bridge-failed", actor: "executor" });
  runtime.recordExecutionOutcome({
    bridgeRequestId: "bridge-failed",
    executionId: "exec-failed",
    reasonCode: "execution_failed",
    actor: "executor",
    nextState: OracleBridgeLifecycleState.ExecutionFailed
  });
  runtime.reconcile({ bridgeRequestId: "bridge-failed", reasonCode: "reconciled_after_failure", actor: "reconciler" });

  const record = runtime.getBridgeRecord("bridge-failed");
  assert.equal(record.state, OracleBridgeLifecycleState.Reconciled);
});

test("terminal reconciled state rejects further transitions", () => {
  const runtime = createOracleBridgePrototypeRuntime();
  runtime.submitBridgeRequest({
    bridgeRequestId: "bridge-terminal",
    correlationId: "corr-terminal",
    decisionId: "dec-terminal",
    actor: "operator"
  });
  runtime.recordApprovalPending({ bridgeRequestId: "bridge-terminal", actor: "approver-queue" });
  runtime.recordApprovalDecision({
    bridgeRequestId: "bridge-terminal",
    approvalId: "approval-terminal",
    reasonCode: "permission_denied",
    actor: "approver",
    nextState: OracleBridgeLifecycleState.Denied
  });
  runtime.reconcile({ bridgeRequestId: "bridge-terminal", reasonCode: "reconciled_after_denial", actor: "reconciler" });

  assert.throws(
    () => runtime.retryApproval({ bridgeRequestId: "bridge-terminal", actor: "watchdog" }),
    /ERR_INVALID_BRIDGE_TRANSITION/
  );
});
