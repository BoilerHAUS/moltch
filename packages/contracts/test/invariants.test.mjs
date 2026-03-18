import test from "node:test";
import assert from "node:assert/strict";
import {
  createDecisionRequest,
  evaluateDecision,
  computeDecisionDigest,
  DecisionReasonCode,
  DecisionVerdict,
  loadOracleBridgeSeamInterface,
  validateOracleBridgeInterface
} from "../src/index.mjs";

test("same normalized input yields same digest", () => {
  const a = computeDecisionDigest({ x: 1, y: ["b", "a"] });
  const b = computeDecisionDigest({ y: ["b", "a"], x: 1 });
  assert.equal(a, b);
});

test("duplicate request payload is idempotent by digest", () => {
  const input = {
    decisionId: "dec-1",
    correlationId: "corr-1",
    actor: "operator",
    evidenceRefs: ["b", "a", "a"],
    payload: { risk: "high" }
  };
  const first = createDecisionRequest(input);
  const second = createDecisionRequest(input);
  assert.equal(first.digest, second.digest);
  assert.deepEqual(first.evidenceRefs, ["a", "b"]);
});

test("invalid reason code is rejected deterministically", () => {
  const request = createDecisionRequest({
    decisionId: "dec-2",
    correlationId: "corr-2",
    actor: "operator",
    evidenceRefs: []
  });

  assert.throws(
    () => evaluateDecision(request, {
      evaluator: "reviewer",
      verdict: DecisionVerdict.HOLD,
      reasonCode: "bad.code"
    }),
    /ERR_INVALID_REASON_CODE/
  );
});

test("valid evaluation includes stable seam fields", () => {
  const request = createDecisionRequest({
    decisionId: "dec-3",
    correlationId: "corr-3",
    actor: "operator",
    evidenceRefs: ["run:123"]
  });

  const result = evaluateDecision(request, {
    evaluator: "approver",
    verdict: DecisionVerdict.GO,
    reasonCode: DecisionReasonCode.READY_FOR_RELEASE,
    notes: "ready"
  });

  assert.equal(result.decisionId, "dec-3");
  assert.equal(result.correlationId, "corr-3");
  assert.equal(result.verdict, "go");
});

test("oracle bridge seam interface captures approval and result linkage contracts", () => {
  const iface = loadOracleBridgeSeamInterface();
  assert.equal(validateOracleBridgeInterface(iface), true);
  assert.deepEqual(iface.approvalRequiredFields, [
    "bridgeRequestId",
    "correlationId",
    "decisionId",
    "approvalId",
    "actor",
    "decisionReasonCode"
  ]);
  assert.deepEqual(iface.resultRequiredFields, [
    "bridgeRequestId",
    "correlationId",
    "decisionId",
    "approvalId",
    "executionId",
    "actor",
    "resultReasonCode",
    "resultRefs"
  ]);
  assert.ok(iface.transitions.approval_pending.includes("approved"));
  assert.ok(iface.transitions.executing.includes("execution_failed"));
});
