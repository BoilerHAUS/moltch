import test from "node:test";
import assert from "node:assert/strict";
import {
  DecisionState,
  TRANSITION_ERROR,
  applyTransition,
  createDecisionContext,
  replayDecisionHistory
} from "../src/index.mjs";

test("valid transition requested -> evaluating", () => {
  const context = createDecisionContext({
    decisionId: "dec-1",
    correlationId: "corr-1",
    actor: "operator"
  });
  const result = applyTransition(DecisionState.REQUESTED, DecisionState.EVALUATING, context);
  assert.equal(result.state, DecisionState.EVALUATING);
});

test("invalid transition requested -> go rejected deterministically", () => {
  const context = createDecisionContext({
    decisionId: "dec-1",
    correlationId: "corr-1",
    actor: "operator",
    reasonCode: "ready.for_release"
  });

  assert.throws(
    () => applyTransition(DecisionState.REQUESTED, DecisionState.GO, context),
    (err) => err.code === TRANSITION_ERROR.INVALID_TRANSITION
  );
});

test("evaluating -> go requires reasonCode", () => {
  const context = createDecisionContext({
    decisionId: "dec-2",
    correlationId: "corr-2",
    actor: "approver"
  });

  assert.throws(
    () => applyTransition(DecisionState.EVALUATING, DecisionState.GO, context),
    (err) => err.code === TRANSITION_ERROR.REQUIRED_FIELDS_MISSING
  );
});

test("replay history reproduces final verdict deterministically", () => {
  const history = [
    {
      nextState: DecisionState.EVALUATING,
      context: { decisionId: "dec-3", correlationId: "corr-3", actor: "operator" }
    },
    {
      nextState: DecisionState.HOLD,
      context: {
        decisionId: "dec-3",
        correlationId: "corr-3",
        actor: "approver",
        reasonCode: "evidence.missing"
      }
    },
    {
      nextState: DecisionState.RECORDED,
      context: {
        decisionId: "dec-3",
        correlationId: "corr-3",
        actor: "recorder",
        reasonCode: "evidence.missing"
      }
    }
  ];

  const replay = replayDecisionHistory(history);
  assert.equal(replay.finalState, DecisionState.RECORDED);
  assert.equal(replay.terminal, true);
  assert.deepEqual(replay.transitions, [
    "requested->evaluating",
    "evaluating->hold",
    "hold->recorded"
  ]);
});
