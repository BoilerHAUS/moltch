import {
  REASON_CODE_ERROR,
  assertReasonCodeAllowed,
  buildReasonCodeIndex,
  loadReasonCodeRegistry
} from "./reasonCodeRegistry.mjs";

const REASON_CODE_INDEX = buildReasonCodeIndex(loadReasonCodeRegistry());

export const DecisionState = Object.freeze({
  REQUESTED: "requested",
  EVALUATING: "evaluating",
  GO: "go",
  HOLD: "hold",
  NO_GO: "no_go",
  RECORDED: "recorded"
});

export const TERMINAL_STATES = Object.freeze([
  DecisionState.RECORDED
]);

const TRANSITION_MAP = Object.freeze({
  [DecisionState.REQUESTED]: [DecisionState.EVALUATING],
  [DecisionState.EVALUATING]: [DecisionState.GO, DecisionState.HOLD, DecisionState.NO_GO],
  [DecisionState.GO]: [DecisionState.RECORDED],
  [DecisionState.HOLD]: [DecisionState.RECORDED],
  [DecisionState.NO_GO]: [DecisionState.RECORDED],
  [DecisionState.RECORDED]: []
});

export const TRANSITION_ERROR = Object.freeze({
  INVALID_STATE: "ERR_INVALID_STATE",
  INVALID_TRANSITION: "ERR_INVALID_TRANSITION",
  REQUIRED_FIELDS_MISSING: "ERR_REQUIRED_FIELDS_MISSING",
  REPLAY_EVENT_INVALID: "ERR_REPLAY_EVENT_INVALID",
  REPLAY_MISMATCH: "ERR_REPLAY_MISMATCH",
  ...REASON_CODE_ERROR
});

function fail(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

function assertState(state) {
  if (!Object.values(DecisionState).includes(state)) {
    throw fail(TRANSITION_ERROR.INVALID_STATE, `unknown state: ${state}`);
  }
}

function assertRequiredContext(context, currentState, nextState) {
  if (!context?.actor || !context?.correlationId || !context?.decisionId) {
    throw fail(TRANSITION_ERROR.REQUIRED_FIELDS_MISSING, "actor, decisionId, correlationId are required");
  }

  const toVerdict = [DecisionState.GO, DecisionState.HOLD, DecisionState.NO_GO].includes(nextState);
  if (currentState === DecisionState.EVALUATING && toVerdict) {
    if (!context.reasonCode) {
      throw fail(TRANSITION_ERROR.REQUIRED_FIELDS_MISSING, "reasonCode is required for verdict transitions");
    }
    assertReasonCodeAllowed(context.reasonCode, REASON_CODE_INDEX);
  }
}

export function isValidTransition(currentState, nextState) {
  assertState(currentState);
  assertState(nextState);
  return TRANSITION_MAP[currentState].includes(nextState);
}

export function createDecisionContext(input) {
  const evidenceRefs = [...new Set((input?.evidenceRefs ?? []).filter(Boolean))].sort();
  const reasonCode = input?.reasonCode ?? null;

  if (reasonCode) {
    assertReasonCodeAllowed(reasonCode, REASON_CODE_INDEX);
  }

  return {
    decisionId: input?.decisionId ?? null,
    correlationId: input?.correlationId ?? null,
    actor: input?.actor ?? null,
    reasonCode,
    evidenceRefs
  };
}

export function applyTransition(currentState, nextState, context) {
  assertRequiredContext(context, currentState, nextState);
  if (!isValidTransition(currentState, nextState)) {
    throw fail(
      TRANSITION_ERROR.INVALID_TRANSITION,
      `invalid transition ${currentState} -> ${nextState}`
    );
  }

  return {
    state: nextState,
    transition: `${currentState}->${nextState}`,
    terminal: TERMINAL_STATES.includes(nextState),
    context: {
      decisionId: context.decisionId,
      correlationId: context.correlationId,
      actor: context.actor,
      reasonCode: context.reasonCode ?? null,
      evidenceRefs: context.evidenceRefs ?? []
    }
  };
}

export function replayDecisionHistory(events, initialState = DecisionState.REQUESTED) {
  assertState(initialState);
  if (!Array.isArray(events)) {
    throw fail(TRANSITION_ERROR.REPLAY_EVENT_INVALID, "events must be an array");
  }

  let state = initialState;
  const transitions = [];

  for (const event of events) {
    const nextState = event?.nextState;
    const context = createDecisionContext(event?.context ?? {});

    if (!nextState) {
      throw fail(TRANSITION_ERROR.REPLAY_EVENT_INVALID, "event missing nextState");
    }

    const applied = applyTransition(state, nextState, context);
    transitions.push(applied.transition);
    state = applied.state;
  }

  return {
    initialState,
    finalState: state,
    transitions,
    terminal: TERMINAL_STATES.includes(state)
  };
}

export function getTransitionTable() {
  return TRANSITION_MAP;
}
