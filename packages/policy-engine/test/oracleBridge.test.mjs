import test from "node:test";
import assert from "node:assert/strict";
import {
  ADAPTER_STATUS_TO_STATE,
  ORACLE_BRIDGE_ERROR,
  OracleBridgeReasonCode,
  OracleBridgeState,
  applyOracleBridgeTransition,
  buildOracleBridgeTrace,
  createBridgeAdapter,
  createOracleBridgeRequest,
  getOracleBridgeTransitionTable,
  reconcileOracleBridgeStatus,
  replayOracleBridgeHistory
} from "../src/index.mjs";

test("oracle bridge request emits deterministic linkage ids and digest", () => {
  const request = createOracleBridgeRequest({
    correlationId: "corr-155-a",
    decisionId: "dec-155-a",
    actor: "offchain_executor",
    evidenceRefs: ["artifact:b", "artifact:a", "artifact:a"]
  });

  assert.match(request.bridgeRequestId, /^obr-/);
  assert.equal(request.correlationId, "corr-155-a");
  assert.deepEqual(request.evidenceRefs, ["artifact:a", "artifact:b"]);
  assert.match(request.digest, /^[a-f0-9]{64}$/);
});

test("approval + execution flow is replayable end-to-end", () => {
  const request = createOracleBridgeRequest({
    bridgeRequestId: "obr-approve-1",
    correlationId: "corr-approve-1",
    decisionId: "dec-approve-1",
    actor: "offchain_executor",
    maxAttempts: 2,
    timeoutSeconds: 300,
    evidenceRefs: ["decision:dec-approve-1"]
  });

  const trace = buildOracleBridgeTrace({
    request,
    events: [
      { nextState: OracleBridgeState.APPROVAL_PENDING, context: { actor: "bridge_adapter" } },
      {
        nextState: OracleBridgeState.APPROVED,
        context: {
          actor: "bridge_contract",
          approvalId: "apr-1",
          decisionReasonCode: OracleBridgeReasonCode.APPROVED
        }
      },
      {
        nextState: OracleBridgeState.EXECUTING,
        context: {
          actor: "offchain_executor",
          approvalId: "apr-1"
        }
      },
      {
        nextState: OracleBridgeState.EXECUTED,
        context: {
          actor: "offchain_executor",
          approvalId: "apr-1",
          executionId: "exe-1",
          resultReasonCode: OracleBridgeReasonCode.APPROVED,
          resultRefs: ["result:exe-1"]
        }
      },
      {
        nextState: OracleBridgeState.RECONCILED,
        context: {
          actor: "bridge_reconciler",
          approvalId: "apr-1",
          executionId: "exe-1",
          resultReasonCode: OracleBridgeReasonCode.APPROVED,
          resultRefs: ["result:exe-1"]
        }
      }
    ]
  });

  assert.equal(trace.finalState, OracleBridgeState.RECONCILED);
  assert.deepEqual(
    trace.steps.map((step) => step.transition),
    [
      "requested->approval_pending",
      "approval_pending->approved",
      "approved->executing",
      "executing->executed",
      "executed->reconciled"
    ]
  );
  assert.ok(trace.steps.every((step) => step.correlation_id === request.correlationId));
  assert.equal(trace.steps[1].approval_id, "apr-1");
  assert.equal(trace.steps[3].execution_id, "exe-1");
});

test("deny path requires a deterministic reason code", () => {
  assert.throws(
    () => applyOracleBridgeTransition(OracleBridgeState.APPROVAL_PENDING, OracleBridgeState.DENIED, {
      bridgeRequestId: "obr-deny-1",
      correlationId: "corr-deny-1",
      decisionId: "dec-deny-1",
      actor: "bridge_contract"
    }),
    (err) => err.code === ORACLE_BRIDGE_ERROR.REQUIRED_FIELDS_MISSING
  );
});

test("timeout can reconcile or retry until max attempts is reached", () => {
  const firstTimeout = reconcileOracleBridgeStatus({
    currentState: OracleBridgeState.APPROVAL_PENDING,
    adapterStatus: "timeout",
    bridgeRequestId: "obr-timeout-1",
    correlationId: "corr-timeout-1",
    decisionId: "dec-timeout-1",
    actor: "bridge_adapter",
    decisionReasonCode: OracleBridgeReasonCode.RETRYABLE_TIMEOUT,
    attempt: 1,
    maxAttempts: 2
  });

  assert.equal(firstTimeout.state, OracleBridgeState.TIMED_OUT);
  assert.equal(firstTimeout.reconciliation.should_retry, true);
  assert.equal(firstTimeout.reconciliation.next_attempt, 2);

  const retry = applyOracleBridgeTransition(OracleBridgeState.TIMED_OUT, OracleBridgeState.APPROVAL_PENDING, {
    bridgeRequestId: "obr-timeout-1",
    correlationId: "corr-timeout-1",
    decisionId: "dec-timeout-1",
    actor: "bridge_adapter",
    decisionReasonCode: OracleBridgeReasonCode.RETRYABLE_TIMEOUT,
    attempt: 1,
    maxAttempts: 2
  });
  assert.equal(retry.state, OracleBridgeState.APPROVAL_PENDING);

  assert.throws(
    () => applyOracleBridgeTransition(OracleBridgeState.TIMED_OUT, OracleBridgeState.APPROVAL_PENDING, {
      bridgeRequestId: "obr-timeout-2",
      correlationId: "corr-timeout-2",
      decisionId: "dec-timeout-2",
      actor: "bridge_adapter",
      decisionReasonCode: OracleBridgeReasonCode.RETRYABLE_TIMEOUT,
      attempt: 2,
      maxAttempts: 2
    }),
    (err) => err.code === ORACLE_BRIDGE_ERROR.INVALID_TRANSITION
  );
});

test("adapter status mapping and replay stay deterministic", () => {
  const adapter = createBridgeAdapter({ name: "oracle_bridge_adapter_v1" });
  assert.equal(adapter.mapStatus("approved_on_chain"), OracleBridgeState.APPROVED);
  assert.deepEqual(Object.keys(ADAPTER_STATUS_TO_STATE).sort(), [
    "approved_on_chain",
    "denied_on_chain",
    "execution_failed",
    "execution_reported",
    "execution_started",
    "reconciled",
    "request_submitted",
    "timeout"
  ]);

  const replay = replayOracleBridgeHistory([
    {
      nextState: OracleBridgeState.APPROVAL_PENDING,
      context: {
        bridgeRequestId: "obr-replay-1",
        correlationId: "corr-replay-1",
        decisionId: "dec-replay-1",
        actor: "bridge_adapter"
      }
    },
    {
      nextState: OracleBridgeState.DENIED,
      context: {
        bridgeRequestId: "obr-replay-1",
        correlationId: "corr-replay-1",
        decisionId: "dec-replay-1",
        actor: "bridge_contract",
        decisionReasonCode: OracleBridgeReasonCode.DENIED
      }
    },
    {
      nextState: OracleBridgeState.RECONCILED,
      context: {
        bridgeRequestId: "obr-replay-1",
        correlationId: "corr-replay-1",
        decisionId: "dec-replay-1",
        actor: "bridge_reconciler",
        decisionReasonCode: OracleBridgeReasonCode.DENIED
      }
    }
  ]);

  assert.deepEqual(replay.transitions, [
    "requested->approval_pending",
    "approval_pending->denied",
    "denied->reconciled"
  ]);
  assert.equal(replay.terminal, true);
  assert.ok(getOracleBridgeTransitionTable()[OracleBridgeState.EXECUTING].includes(OracleBridgeState.EXECUTION_FAILED));
});
