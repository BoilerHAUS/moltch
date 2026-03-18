import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  buildSimulationReport,
  loadScenarioSuite,
  renderSimulationMarkdown
} from "../src/decisionLoopSimulation.mjs";

const suite = loadScenarioSuite();

test("simulation harness covers five core decision paths deterministically", () => {
  const report = buildSimulationReport(suite);
  assert.equal(report.total_scenarios, 5);
  assert.deepEqual(
    report.scenario_matrix.map((entry) => entry.scenario_id),
    [
      "happy-path-go",
      "human-hold",
      "deny-permission",
      "timeout-hold",
      "retry-recovers-to-go"
    ]
  );
  assert.equal(report.reason_code_counts.executed, 2);
  assert.equal(report.reason_code_counts.blocked_needs_human, 1);
  assert.equal(report.reason_code_counts.permission_denied, 1);
  assert.equal(report.reason_code_counts.validation_failed, 1);
});

test("simulation trace emits correlation ids, reason codes, and stable transitions", () => {
  const report = buildSimulationReport(suite);
  for (const scenario of report.scenarios) {
    assert.match(scenario.correlation_id, /^corr-/);
    assert.match(scenario.decision_id, /^dec-/);
    assert.deepEqual(scenario.transitions, [
      "requested->evaluating",
      `evaluating->${scenario.launch.decision === "go" ? "go" : scenario.launch.decision === "hold" ? "hold" : "no_go"}`,
      `${scenario.launch.decision === "go" ? "go" : scenario.launch.decision === "hold" ? "hold" : "no_go"}->recorded`
    ]);
    assert.equal(scenario.trace.length, 4);
    assert.ok(scenario.trace.every((event) => event.correlation_id === scenario.correlation_id));
  }
});

test("checked-in simulation artifacts match generated deterministic report", () => {
  const report = buildSimulationReport(suite);
  const expectedJson = JSON.stringify(report, null, 2) + "\n";
  const expectedMd = renderSimulationMarkdown(report);
  const artifactJson = fs.readFileSync(new URL("../artifacts/decision-loop-simulation.report.json", import.meta.url), "utf8");
  const artifactMd = fs.readFileSync(new URL("../artifacts/decision-loop-simulation.report.md", import.meta.url), "utf8");

  assert.equal(artifactJson, expectedJson);
  assert.equal(artifactMd, expectedMd);
});
