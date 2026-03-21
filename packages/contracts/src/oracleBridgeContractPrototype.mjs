import fs from "node:fs";

export const OracleBridgeLifecycleState = Object.freeze({
  None: 0,
  Requested: 1,
  ApprovalPending: 2,
  Approved: 3,
  Denied: 4,
  Executing: 5,
  Executed: 6,
  ExecutionFailed: 7,
  TimedOut: 8,
  Reconciled: 9
});

export function loadOracleBridgeApprovalSurfaceSource(pathOrUrl = new URL("../contracts/OracleBridgeApprovalSurfaceV1.sol", import.meta.url)) {
  return fs.readFileSync(pathOrUrl, "utf8");
}

export function validateOracleBridgeApprovalSurfaceSource(source) {
  if (!source.includes("contract OracleBridgeApprovalSurfaceV1")) throw new Error("ERR_CONTRACT_NAME_MISSING");
  if (!source.includes("event BridgeRequested")) throw new Error("ERR_REQUEST_EVENT_MISSING");
  if (!source.includes("event BridgeApprovalRecorded")) throw new Error("ERR_APPROVAL_EVENT_MISSING");
  if (!source.includes("event BridgeExecutionRecorded")) throw new Error("ERR_EXECUTION_EVENT_MISSING");
  if (!source.includes("error ErrInvalidBridgeTransition")) throw new Error("ERR_INVALID_TRANSITION_ERROR_MISSING");
  return true;
}

export function createOracleBridgePrototypeRuntime() {
  const records = new Map();
  const seenExecutionIds = new Set();
  const events = [];

  function requireNonZero(...values) {
    if (values.some((value) => !value)) throw new Error("ERR_REQUIRED_FIELD_MISSING");
  }

  function assertTransition(current, nextState) {
    const valid =
      (current === OracleBridgeLifecycleState.Requested && nextState === OracleBridgeLifecycleState.ApprovalPending) ||
      (current === OracleBridgeLifecycleState.ApprovalPending && [OracleBridgeLifecycleState.Approved, OracleBridgeLifecycleState.Denied, OracleBridgeLifecycleState.TimedOut].includes(nextState)) ||
      (current === OracleBridgeLifecycleState.Approved && [OracleBridgeLifecycleState.Executing, OracleBridgeLifecycleState.TimedOut].includes(nextState)) ||
      (current === OracleBridgeLifecycleState.Executing && [OracleBridgeLifecycleState.Executed, OracleBridgeLifecycleState.ExecutionFailed, OracleBridgeLifecycleState.TimedOut].includes(nextState)) ||
      (current === OracleBridgeLifecycleState.TimedOut && [OracleBridgeLifecycleState.ApprovalPending, OracleBridgeLifecycleState.Reconciled].includes(nextState)) ||
      ([OracleBridgeLifecycleState.Denied, OracleBridgeLifecycleState.Executed, OracleBridgeLifecycleState.ExecutionFailed].includes(current) && nextState === OracleBridgeLifecycleState.Reconciled);

    if (!valid) throw new Error(`ERR_INVALID_BRIDGE_TRANSITION:${current}->${nextState}`);
  }

  function getRecord(bridgeRequestId) {
    const record = records.get(bridgeRequestId);
    if (!record) throw new Error("ERR_BRIDGE_REQUEST_NOT_FOUND");
    return record;
  }

  function submitBridgeRequest({ bridgeRequestId, correlationId, decisionId, actor }) {
    requireNonZero(bridgeRequestId, correlationId, decisionId, actor);
    if (records.has(bridgeRequestId)) throw new Error("ERR_BRIDGE_REQUEST_ALREADY_EXISTS");

    const record = {
      bridgeRequestId,
      correlationId,
      decisionId,
      approvalId: null,
      executionId: null,
      actor,
      reasonCode: null,
      state: OracleBridgeLifecycleState.Requested
    };
    records.set(bridgeRequestId, record);
    events.push({ type: "BridgeRequested", bridgeRequestId, correlationId, decisionId, actor });
    return structuredClone(record);
  }

  function recordApprovalPending({ bridgeRequestId, actor }) {
    requireNonZero(bridgeRequestId, actor);
    const record = getRecord(bridgeRequestId);
    assertTransition(record.state, OracleBridgeLifecycleState.ApprovalPending);
    record.actor = actor;
    record.state = OracleBridgeLifecycleState.ApprovalPending;
    events.push({ type: "BridgeApprovalRecorded", bridgeRequestId, approvalId: null, nextState: record.state, reasonCode: null, actor });
    return structuredClone(record);
  }

  function recordApprovalDecision({ bridgeRequestId, approvalId, reasonCode, actor, nextState }) {
    requireNonZero(bridgeRequestId, approvalId, reasonCode, actor);
    const record = getRecord(bridgeRequestId);
    if (![OracleBridgeLifecycleState.Approved, OracleBridgeLifecycleState.Denied].includes(nextState)) {
      throw new Error(`ERR_INVALID_BRIDGE_TRANSITION:${record.state}->${nextState}`);
    }
    assertTransition(record.state, nextState);
    record.approvalId = approvalId;
    record.reasonCode = reasonCode;
    record.actor = actor;
    record.state = nextState;
    events.push({ type: "BridgeApprovalRecorded", bridgeRequestId, approvalId, nextState, reasonCode, actor });
    return structuredClone(record);
  }

  function beginExecution({ bridgeRequestId, actor }) {
    requireNonZero(bridgeRequestId, actor);
    const record = getRecord(bridgeRequestId);
    assertTransition(record.state, OracleBridgeLifecycleState.Executing);
    record.actor = actor;
    record.state = OracleBridgeLifecycleState.Executing;
    events.push({ type: "BridgeExecutionRecorded", bridgeRequestId, executionId: null, nextState: record.state, reasonCode: null, actor });
    return structuredClone(record);
  }

  function recordExecutionOutcome({ bridgeRequestId, executionId, reasonCode, actor, nextState }) {
    requireNonZero(bridgeRequestId, executionId, reasonCode, actor);
    const record = getRecord(bridgeRequestId);
    if (![OracleBridgeLifecycleState.Executed, OracleBridgeLifecycleState.ExecutionFailed].includes(nextState)) {
      throw new Error(`ERR_INVALID_BRIDGE_TRANSITION:${record.state}->${nextState}`);
    }
    if (seenExecutionIds.has(executionId)) throw new Error("ERR_EXECUTION_ALREADY_RECORDED");
    assertTransition(record.state, nextState);
    seenExecutionIds.add(executionId);
    record.executionId = executionId;
    record.reasonCode = reasonCode;
    record.actor = actor;
    record.state = nextState;
    events.push({ type: "BridgeExecutionRecorded", bridgeRequestId, executionId, nextState, reasonCode, actor });
    return structuredClone(record);
  }

  function recordTimeout({ bridgeRequestId, reasonCode, actor }) {
    requireNonZero(bridgeRequestId, reasonCode, actor);
    const record = getRecord(bridgeRequestId);
    assertTransition(record.state, OracleBridgeLifecycleState.TimedOut);
    record.reasonCode = reasonCode;
    record.actor = actor;
    record.state = OracleBridgeLifecycleState.TimedOut;
    if (!record.approvalId) {
      events.push({ type: "BridgeApprovalRecorded", bridgeRequestId, approvalId: null, nextState: record.state, reasonCode, actor });
    } else {
      events.push({ type: "BridgeExecutionRecorded", bridgeRequestId, executionId: record.executionId, nextState: record.state, reasonCode, actor });
    }
    return structuredClone(record);
  }

  function retryApproval({ bridgeRequestId, actor }) {
    requireNonZero(bridgeRequestId, actor);
    const record = getRecord(bridgeRequestId);
    assertTransition(record.state, OracleBridgeLifecycleState.ApprovalPending);
    record.actor = actor;
    record.state = OracleBridgeLifecycleState.ApprovalPending;
    events.push({ type: "BridgeApprovalRecorded", bridgeRequestId, approvalId: record.approvalId, nextState: record.state, reasonCode: record.reasonCode, actor });
    return structuredClone(record);
  }

  function reconcile({ bridgeRequestId, reasonCode, actor }) {
    requireNonZero(bridgeRequestId, reasonCode, actor);
    const record = getRecord(bridgeRequestId);
    assertTransition(record.state, OracleBridgeLifecycleState.Reconciled);
    record.reasonCode = reasonCode;
    record.actor = actor;
    record.state = OracleBridgeLifecycleState.Reconciled;
    events.push({ type: "BridgeExecutionRecorded", bridgeRequestId, executionId: record.executionId, nextState: record.state, reasonCode, actor });
    return structuredClone(record);
  }

  return {
    events,
    submitBridgeRequest,
    recordApprovalPending,
    recordApprovalDecision,
    beginExecution,
    recordExecutionOutcome,
    recordTimeout,
    retryApproval,
    reconcile,
    getBridgeRecord(bridgeRequestId) {
      return structuredClone(getRecord(bridgeRequestId));
    }
  };
}
