import test from "node:test";
import assert from "node:assert/strict";
import {
  DecisionState,
  REASON_CODE_ERROR,
  TRANSITION_ERROR,
  applyTransition,
  assertReasonCodeAllowed,
  buildReasonCodeIndex,
  createDecisionContext,
  replayDecisionHistory,
  validateRegistryShape,
  buildMigrationReport,
  resolveReasonCodeLifecycle,
  REASON_CODE_MIGRATION_ERROR,
  validateMigrationMapShape
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
    reasonCode: "executed"
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
        reasonCode: "missing_approval"
      }
    },
    {
      nextState: DecisionState.RECORDED,
      context: {
        decisionId: "dec-3",
        correlationId: "corr-3",
        actor: "recorder",
        reasonCode: "missing_approval"
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

test("createDecisionContext rejects unknown reason codes", () => {
  assert.throws(
    () => createDecisionContext({ reasonCode: "not_real_code" }),
    (err) => err.code === REASON_CODE_ERROR.CODE_UNKNOWN
  );
});

test("deprecated reason code is rejected by default", () => {
  const index = buildReasonCodeIndex({
    version: "v-test",
    codes: [
      { code: "legacy_code", status: "deprecated", replacement: "executed" }
    ]
  });

  assert.throws(
    () => assertReasonCodeAllowed("legacy_code", index),
    (err) => err.code === REASON_CODE_ERROR.CODE_DEPRECATED
  );
});

test("registry validator rejects duplicate entries", () => {
  assert.throws(
    () => validateRegistryShape({
      version: "v-test",
      codes: [
        { code: "executed", status: "active" },
        { code: "executed", status: "active" }
      ]
    }),
    (err) => err.code === REASON_CODE_ERROR.REGISTRY_INVALID
  );
});

test("migration resolver remaps legacy code deterministically", () => {
  const registryIndex = buildReasonCodeIndex({
    version: "v1.3.0",
    codes: [{ code: "missing_approval", status: "active" }]
  });
  const migrationMap = {
    version: "v1",
    source_version: "v1.2.0",
    target_version: "v1.3.0",
    mappings: [{ from: "approval_missing", to: "missing_approval", status: "remap" }]
  };

  const result = resolveReasonCodeLifecycle("approval_missing", { registryIndex, migrationMap });
  assert.equal(result.resolved, "missing_approval");
  assert.equal(result.mapping_applied, true);
});

test("migration map validator rejects ambiguous mappings", () => {
  assert.throws(
    () => validateMigrationMapShape({
      version: "v1",
      mappings: [
        { from: "approval_missing", to: "missing_approval" },
        { from: "approval_missing", to: "threshold_unmet" }
      ]
    }),
    (err) => err.code === REASON_CODE_MIGRATION_ERROR.MAP_AMBIGUOUS
  );
});

test("migration report emits deterministic counts", () => {
  const registryIndex = buildReasonCodeIndex({
    version: "v1.3.0",
    codes: [{ code: "missing_approval", status: "active" }]
  });
  const migrationMap = {
    version: "v1",
    source_version: "v1.2.0",
    target_version: "v1.3.0",
    mappings: [{ from: "approval_missing", to: "missing_approval", status: "remap" }]
  };

  const report = buildMigrationReport([
    { reason_code: "approval_missing" },
    { reason_code: "approval_missing" }
  ], { registryIndex, migrationMap });

  assert.equal(report.total_records, 2);
  assert.equal(report.migrated_records, 2);
  assert.equal(report.policy_status_counts.active, 2);
  assert.equal(report.mappings.approval_missing, "missing_approval");
});
