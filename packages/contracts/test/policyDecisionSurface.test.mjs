import test from "node:test";
import assert from "node:assert/strict";
import {
  createPolicyDecisionPrototypeRuntime,
  loadPolicyDecisionSurfaceSource,
  validatePolicyDecisionSurfaceSource,
  PolicyLifecycleState
} from "../src/policyDecisionContractPrototype.mjs";

test("solidity prototype source exposes the expected contract/events/errors", () => {
  const source = loadPolicyDecisionSurfaceSource();
  assert.equal(validatePolicyDecisionSurfaceSource(source), true);
});

test("happy path request -> evaluate -> verdict -> record is deterministic", () => {
  const runtime = createPolicyDecisionPrototypeRuntime();
  runtime.requestDecision({
    decisionId: "dec-183",
    correlationId: "corr-183",
    requestDigest: "digest-183",
    actor: "operator"
  });
  runtime.evaluateDecision({ decisionId: "dec-183", reasonCode: "ready_for_release", actor: "reviewer", nextState: PolicyLifecycleState.Evaluating });
  runtime.evaluateDecision({ decisionId: "dec-183", reasonCode: "ready_for_release", actor: "reviewer", nextState: PolicyLifecycleState.Go });
  runtime.evaluateDecision({ decisionId: "dec-183", reasonCode: "recorded", actor: "recorder", nextState: PolicyLifecycleState.Recorded });

  const record = runtime.getDecision("dec-183");
  assert.equal(record.state, PolicyLifecycleState.Recorded);
  assert.equal(runtime.events.map((event) => event.type).join(","), "DecisionRequested,DecisionEvaluated,DecisionEvaluated,DecisionEvaluated,DecisionRecorded");
});

test("invalid transition is rejected with stable failure mode", () => {
  const runtime = createPolicyDecisionPrototypeRuntime();
  runtime.requestDecision({
    decisionId: "dec-bad",
    correlationId: "corr-bad",
    requestDigest: "digest-bad",
    actor: "operator"
  });

  assert.throws(
    () => runtime.evaluateDecision({ decisionId: "dec-bad", reasonCode: "bad", actor: "reviewer", nextState: PolicyLifecycleState.Recorded }),
    /ERR_INVALID_TRANSITION/
  );
});

test("malformed request is rejected deterministically", () => {
  const runtime = createPolicyDecisionPrototypeRuntime();
  assert.throws(
    () => runtime.requestDecision({ decisionId: "", correlationId: "corr", requestDigest: "digest", actor: "operator" }),
    /ERR_REQUIRED_FIELD_MISSING/
  );
});
