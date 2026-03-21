import fs from "node:fs";

export const PolicyLifecycleState = Object.freeze({
  None: 0,
  Requested: 1,
  Evaluating: 2,
  Go: 3,
  Hold: 4,
  NoGo: 5,
  Recorded: 6
});

export function loadPolicyDecisionSurfaceSource(pathOrUrl = new URL("../contracts/PolicyDecisionSurfaceV1.sol", import.meta.url)) {
  return fs.readFileSync(pathOrUrl, "utf8");
}

export function validatePolicyDecisionSurfaceSource(source) {
  if (!source.includes("contract PolicyDecisionSurfaceV1")) throw new Error("ERR_CONTRACT_NAME_MISSING");
  if (!source.includes("event DecisionRequested")) throw new Error("ERR_REQUEST_EVENT_MISSING");
  if (!source.includes("event DecisionEvaluated")) throw new Error("ERR_EVALUATE_EVENT_MISSING");
  if (!source.includes("event DecisionRecorded")) throw new Error("ERR_RECORDED_EVENT_MISSING");
  if (!source.includes("error ErrInvalidTransition")) throw new Error("ERR_INVALID_TRANSITION_ERROR_MISSING");
  return true;
}

export function createPolicyDecisionPrototypeRuntime() {
  const records = new Map();
  const events = [];

  function requireNonZero(...values) {
    if (values.some((value) => !value)) throw new Error("ERR_REQUIRED_FIELD_MISSING");
  }

  function requestDecision({ decisionId, correlationId, requestDigest, actor }) {
    requireNonZero(decisionId, correlationId, requestDigest, actor);
    if (records.has(decisionId)) throw new Error("ERR_DECISION_ALREADY_EXISTS");
    const record = {
      decisionId,
      correlationId,
      requestDigest,
      reasonCode: null,
      actor,
      state: PolicyLifecycleState.Requested
    };
    records.set(decisionId, record);
    events.push({ type: "DecisionRequested", decisionId, correlationId, requestDigest, actor });
    return record;
  }

  function evaluateDecision({ decisionId, reasonCode, actor, nextState }) {
    requireNonZero(decisionId, reasonCode, actor);
    const record = records.get(decisionId);
    if (!record) throw new Error("ERR_DECISION_NOT_FOUND");

    const current = record.state;
    const valid =
      (current === PolicyLifecycleState.Requested && nextState === PolicyLifecycleState.Evaluating) ||
      (current === PolicyLifecycleState.Evaluating && [PolicyLifecycleState.Go, PolicyLifecycleState.Hold, PolicyLifecycleState.NoGo].includes(nextState)) ||
      ([PolicyLifecycleState.Go, PolicyLifecycleState.Hold, PolicyLifecycleState.NoGo].includes(current) && nextState === PolicyLifecycleState.Recorded);

    if (!valid) throw new Error(`ERR_INVALID_TRANSITION:${current}->${nextState}`);

    record.reasonCode = reasonCode;
    record.actor = actor;
    record.state = nextState;
    events.push({ type: "DecisionEvaluated", decisionId, correlationId: record.correlationId, nextState, reasonCode, actor });
    if (nextState === PolicyLifecycleState.Recorded) {
      events.push({ type: "DecisionRecorded", decisionId, correlationId: record.correlationId, finalState: nextState });
    }
    return record;
  }

  return {
    events,
    requestDecision,
    evaluateDecision,
    getDecision(decisionId) {
      const record = records.get(decisionId);
      if (!record) throw new Error("ERR_DECISION_NOT_FOUND");
      return structuredClone(record);
    }
  };
}
