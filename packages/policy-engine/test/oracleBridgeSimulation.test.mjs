import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  buildOracleBridgeSimulationReport,
  loadOracleBridgeScenarioSuite,
  renderOracleBridgeSimulationMarkdown
} from "../src/index.mjs";

const suite = loadOracleBridgeScenarioSuite();

test("oracle bridge simulation covers approve, deny, and timeout deterministically", () => {
  const report = buildOracleBridgeSimulationReport(suite);
  assert.equal(report.total_scenarios, 3);
  assert.deepEqual(
    report.scenario_matrix.map((entry) => entry.scenario_id),
    ["approve-execute-success", "deny-on-chain", "timeout-then-reconcile"]
  );
  assert.deepEqual(
    report.scenario_matrix.map((entry) => entry.final_state),
    ["reconciled", "reconciled", "reconciled"]
  );
});

test("oracle bridge trace links correlation, approval, and execution ids end-to-end", () => {
  const report = buildOracleBridgeSimulationReport(suite);
  const approved = report.scenarios.find((scenario) => scenario.scenario_id === "approve-execute-success");
  assert.ok(approved);
  assert.match(approved.correlation_id, /^corr-/);
  assert.match(approved.bridge_request_id, /^obr-/);
  assert.match(approved.decision_id, /^dec-/);
  assert.equal(approved.trace[1].approval_id, "apr-success-1");
  assert.equal(approved.trace[3].execution_id, "exe-success-1");
  assert.ok(approved.trace.every((event) => event.correlation_id === approved.correlation_id));
});

test("oracle bridge simulation artifacts stay in sync", () => {
  const report = buildOracleBridgeSimulationReport(suite);
  const expectedJson = JSON.stringify(report, null, 2) + "\n";
  const expectedMd = renderOracleBridgeSimulationMarkdown(report);
  const artifactJson = fs.readFileSync(new URL("../artifacts/oracle-bridge-simulation.report.json", import.meta.url), "utf8");
  const artifactMd = fs.readFileSync(new URL("../artifacts/oracle-bridge-simulation.report.md", import.meta.url), "utf8");

  assert.equal(artifactJson, expectedJson);
  assert.equal(artifactMd, expectedMd);
});
