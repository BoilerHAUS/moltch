import crypto from "node:crypto";
import {
  REASON_CODE_ERROR,
  assertReasonCodeAllowed,
  buildReasonCodeIndex,
  loadReasonCodeRegistry
} from "./reasonCodeRegistry.mjs";

const REASON_CODE_INDEX = buildReasonCodeIndex(loadReasonCodeRegistry());

export const OracleBridgeState = Object.freeze({
  REQUESTED: "requested",
  APPROVAL_PENDING: "approval_pending",
  APPROVED: "approved",
  DENIED: "denied",
  EXECUTING: "executing",
  EXECUTED: "executed",
  EXECUTION_FAILED: "execution_failed",
  TIMED_OUT: "timed_out",
  RECONCILED: "reconciled"
});

export const ORACLE_TERMINAL_STATES = Object.freeze([
  OracleBridgeState.DENIED,
  OracleBridgeState.EXECUTED,
  OracleBridgeState.EXECUTION_FAILED,
  OracleBridgeState.TIMED_OUT,
  OracleBridgeState.RECONCILED
]);

const TRANSITION_MAP = Object.freeze({
  [OracleBridgeState.REQUESTED]: [OracleBridgeState.APPROVAL_PENDING],
  [OracleBridgeState.APPROVAL_PENDING]: [
    OracleBridgeState.APPROVED,
    OracleBridgeState.DENIED,
    OracleBridgeState.TIMED_OUT
  ],
  [OracleBridgeState.APPROVED]: [OracleBridgeState.EXECUTING, OracleBridgeState.TIMED_OUT],
  [OracleBridgeState.DENIED]: [OracleBridgeState.RECONCILED],
  [OracleBridgeState.EXECUTING]: [
    OracleBridgeState.EXECUTED,
    OracleBridgeState.EXECUTION_FAILED,
    OracleBridgeState.TIMED_OUT
  ],
  [OracleBridgeState.EXECUTED]: [OracleBridgeState.RECONCILED],
  [OracleBridgeState.EXECUTION_FAILED]: [OracleBridgeState.RECONCILED],
  [OracleBridgeState.TIMED_OUT]: [OracleBridgeState.APPROVAL_PENDING, OracleBridgeState.RECONCILED],
  [OracleBridgeState.RECONCILED]: []
});

export const ORACLE_BRIDGE_ERROR = Object.freeze({
  INVALID_STATE: "ERR_ORACLE_BRIDGE_INVALID_STATE",
  INVALID_TRANSITION: "ERR_ORACLE_BRIDGE_INVALID_TRANSITION",
  REQUIRED_FIELDS_MISSING: "ERR_ORACLE_BRIDGE_REQUIRED_FIELDS_MISSING",
  INVALID_REASON_CODE: "ERR_ORACLE_BRIDGE_INVALID_REASON_CODE",
  INVALID_STATUS: "ERR_ORACLE_BRIDGE_INVALID_STATUS",
  REPLAY_EVENT_INVALID: "ERR_ORACLE_BRIDGE_REPLAY_EVENT_INVALID",
  ...REASON_CODE_ERROR
});

export const OracleBridgeReasonCode = Object.freeze({
  APPROVED: "executed",
  DENIED: "permission_denied",
  APPROVAL_TIMEOUT: "approval_stale",
  RETRYABLE_TIMEOUT: "validation_failed",
  EXECUTION_FAILED: "execution_failed",
  DUPLICATE: "idempotency_replay",
  MISSING_APPROVAL: "missing_approval"
});

export const ADAPTER_STATUS_TO_STATE = Object.freeze({
  request_submitted: OracleBridgeState.APPROVAL_PENDING,
  approved_on_chain: OracleBridgeState.APPROVED,
  denied_on_chain: OracleBridgeState.DENIED,
  execution_started: OracleBridgeState.EXECUTING,
  execution_reported: OracleBridgeState.EXECUTED,
  execution_failed: OracleBridgeState.EXECUTION_FAILED,
  timeout: OracleBridgeState.TIMED_OUT,
  reconciled: OracleBridgeState.RECONCILED
});

function fail(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

function stableHash(input, length = 12) {
  return crypto.createHash("sha256").update(String(input)).digest("hex").slice(0, length);
}

function assertState(state) {
  if (!Object.values(OracleBridgeState).includes(state)) {
    throw fail(ORACLE_BRIDGE_ERROR.INVALID_STATE, `unknown oracle bridge state: ${state}`);
  }
}

function assertReasonCode(reasonCode) {
  if (!reasonCode) return null;
  try {
    return assertReasonCodeAllowed(reasonCode, REASON_CODE_INDEX);
  } catch (err) {
    throw fail(err.code ?? ORACLE_BRIDGE_ERROR.INVALID_REASON_CODE, err.message);
  }
}

export function createOracleBridgeContext(input = {}) {
  const evidenceRefs = [...new Set((input.evidenceRefs ?? []).filter(Boolean))].sort();
  const resultRefs = [...new Set((input.resultRefs ?? []).filter(Boolean))].sort();
  const decisionReasonCode = input.decisionReasonCode ?? null;
  const resultReasonCode = input.resultReasonCode ?? null;

  if (decisionReasonCode) assertReasonCode(decisionReasonCode);
  if (resultReasonCode) assertReasonCode(resultReasonCode);

  return {
    bridgeRequestId: input.bridgeRequestId ?? null,
    correlationId: input.correlationId ?? null,
    decisionId: input.decisionId ?? null,
    approvalId: input.approvalId ?? null,
    executionId: input.executionId ?? null,
    actor: input.actor ?? null,
    adapter: input.adapter ?? "oracle_bridge_adapter_v1",
    attempt: Number.isInteger(input.attempt) && input.attempt > 0 ? input.attempt : 1,
    maxAttempts: Number.isInteger(input.maxAttempts) && input.maxAttempts > 0 ? input.maxAttempts : 1,
    timeoutSeconds: Number.isInteger(input.timeoutSeconds) && input.timeoutSeconds > 0 ? input.timeoutSeconds : null,
    decisionReasonCode,
    resultReasonCode,
    evidenceRefs,
    resultRefs,
    metadata: input.metadata ?? {}
  };
}

function assertRequiredContext(context) {
  if (!context?.bridgeRequestId || !context?.correlationId || !context?.decisionId || !context?.actor) {
    throw fail(
      ORACLE_BRIDGE_ERROR.REQUIRED_FIELDS_MISSING,
      "bridgeRequestId, correlationId, decisionId, actor are required"
    );
  }
}

function assertTransitionContext(currentState, nextState, context) {
  assertRequiredContext(context);

  if (nextState === OracleBridgeState.APPROVED && !context.approvalId) {
    throw fail(ORACLE_BRIDGE_ERROR.REQUIRED_FIELDS_MISSING, "approvalId is required for approved transition");
  }

  if (
    [OracleBridgeState.DENIED, OracleBridgeState.TIMED_OUT].includes(nextState) &&
    !context.decisionReasonCode
  ) {
    throw fail(ORACLE_BRIDGE_ERROR.REQUIRED_FIELDS_MISSING, "decisionReasonCode is required for deny/timeout transitions");
  }

  if (
    [OracleBridgeState.EXECUTED, OracleBridgeState.EXECUTION_FAILED].includes(nextState) &&
    (!context.executionId || !context.resultReasonCode)
  ) {
    throw fail(
      ORACLE_BRIDGE_ERROR.REQUIRED_FIELDS_MISSING,
      "executionId and resultReasonCode are required for execution result transitions"
    );
  }

  if (currentState === OracleBridgeState.TIMED_OUT && nextState === OracleBridgeState.APPROVAL_PENDING) {
    if (context.attempt >= context.maxAttempts) {
      throw fail(ORACLE_BRIDGE_ERROR.INVALID_TRANSITION, "cannot retry once maxAttempts has been reached");
    }
  }
}

export function isValidOracleBridgeTransition(currentState, nextState) {
  assertState(currentState);
  assertState(nextState);
  return TRANSITION_MAP[currentState].includes(nextState);
}

export function applyOracleBridgeTransition(currentState, nextState, contextInput) {
  const context = createOracleBridgeContext(contextInput);
  assertTransitionContext(currentState, nextState, context);

  if (!isValidOracleBridgeTransition(currentState, nextState)) {
    throw fail(
      ORACLE_BRIDGE_ERROR.INVALID_TRANSITION,
      `invalid oracle bridge transition ${currentState} -> ${nextState}`
    );
  }

  return {
    state: nextState,
    transition: `${currentState}->${nextState}`,
    terminal: ORACLE_TERMINAL_STATES.includes(nextState),
    context
  };
}

export function createOracleBridgeRequest(input = {}) {
  const context = createOracleBridgeContext({
    ...input,
    bridgeRequestId: input.bridgeRequestId ?? `obr-${stableHash(`${input.correlationId}:${input.decisionId}:${input.actor}`)}`
  });
  assertRequiredContext(context);

  return {
    ...context,
    digest: crypto
      .createHash("sha256")
      .update(JSON.stringify({
        bridgeRequestId: context.bridgeRequestId,
        correlationId: context.correlationId,
        decisionId: context.decisionId,
        actor: context.actor,
        adapter: context.adapter,
        evidenceRefs: context.evidenceRefs,
        metadata: context.metadata
      }))
      .digest("hex")
  };
}

export function createBridgeAdapter(options = {}) {
  return {
    name: options.name ?? "oracle_bridge_adapter_v1",
    toAdapterRequest(request) {
      return {
        request_id: request.bridgeRequestId,
        correlation_id: request.correlationId,
        decision_id: request.decisionId,
        request_digest: request.digest,
        actor: request.actor,
        evidence_refs: request.evidenceRefs,
        metadata: request.metadata
      };
    },
    mapStatus(status) {
      const mapped = ADAPTER_STATUS_TO_STATE[status];
      if (!mapped) {
        throw fail(ORACLE_BRIDGE_ERROR.INVALID_STATUS, `unsupported adapter status: ${status}`);
      }
      return mapped;
    }
  };
}

export function reconcileOracleBridgeStatus(snapshot, options = {}) {
  const adapter = options.adapter ?? createBridgeAdapter();
  const currentState = snapshot?.currentState ?? OracleBridgeState.REQUESTED;
  assertState(currentState);

  const nextState = adapter.mapStatus(snapshot?.adapterStatus);
  const context = createOracleBridgeContext({
    ...snapshot,
    adapter: adapter.name,
    attempt: snapshot?.attempt ?? 1,
    maxAttempts: snapshot?.maxAttempts ?? 1
  });

  const applied = applyOracleBridgeTransition(currentState, nextState, context);
  return {
    ...applied,
    reconciliation: {
      adapter_status: snapshot.adapterStatus,
      hook: snapshot.hook ?? "poll",
      should_retry:
        nextState === OracleBridgeState.TIMED_OUT && context.attempt < context.maxAttempts,
      next_attempt:
        nextState === OracleBridgeState.TIMED_OUT && context.attempt < context.maxAttempts
          ? context.attempt + 1
          : context.attempt
    }
  };
}

export function buildOracleBridgeTrace(input = {}) {
  const request = createOracleBridgeRequest(input.request);
  const steps = [];
  let state = OracleBridgeState.REQUESTED;

  for (const event of input.events ?? []) {
    const applied = applyOracleBridgeTransition(state, event.nextState, {
      ...request,
      ...event.context
    });
    steps.push({
      transition: applied.transition,
      state: applied.state,
      correlation_id: applied.context.correlationId,
      bridge_request_id: applied.context.bridgeRequestId,
      approval_id: applied.context.approvalId,
      execution_id: applied.context.executionId,
      decision_reason_code: applied.context.decisionReasonCode,
      result_reason_code: applied.context.resultReasonCode,
      attempt: applied.context.attempt
    });
    state = applied.state;
  }

  return {
    request,
    finalState: state,
    steps
  };
}

export function replayOracleBridgeHistory(events, initialState = OracleBridgeState.REQUESTED) {
  assertState(initialState);
  if (!Array.isArray(events)) {
    throw fail(ORACLE_BRIDGE_ERROR.REPLAY_EVENT_INVALID, "events must be an array");
  }

  let state = initialState;
  const transitions = [];

  for (const event of events) {
    if (!event?.nextState) {
      throw fail(ORACLE_BRIDGE_ERROR.REPLAY_EVENT_INVALID, "event missing nextState");
    }
    const applied = applyOracleBridgeTransition(state, event.nextState, event.context);
    transitions.push(applied.transition);
    state = applied.state;
  }

  return {
    initialState,
    finalState: state,
    transitions,
    terminal: ORACLE_TERMINAL_STATES.includes(state)
  };
}

export function getOracleBridgeTransitionTable() {
  return TRANSITION_MAP;
}
