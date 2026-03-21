import fs from "node:fs";
import crypto from "node:crypto";
import {
  DecisionState,
  applyTransition,
  createDecisionContext,
  loadReasonCodeRegistry
} from "./index.mjs";

const LAUNCH_DECISION_TO_STATE = Object.freeze({
  go: DecisionState.GO,
  hold: DecisionState.HOLD,
  no_go: DecisionState.NO_GO
});

const EVIDENCE_STATUS_REASON_CODE = Object.freeze({
  valid: "executed",
  skipped: null,
  timeout: "validation_failed",
  retry_success: "executed"
});

function stableHash(input, length = 10) {
  return crypto.createHash("sha256").update(String(input)).digest("hex").slice(0, length);
}

function isoAt(base, offsetMinutes) {
  const dt = new Date(base);
  dt.setUTCMinutes(dt.getUTCMinutes() + offsetMinutes);
  return dt.toISOString().replace(".000Z", "Z");
}

function makeContext(baseContext, actor, reasonCode = null, evidenceRefs = []) {
  return createDecisionContext({
    ...baseContext,
    actor,
    reasonCode,
    evidenceRefs
  });
}

function buildTraceEvent({ phase, status, actor, state, reasonCode = null, correlationId, detail = {}, at }) {
  return {
    at,
    phase,
    status,
    actor,
    state,
    correlation_id: correlationId,
    reason_code: reasonCode,
    detail
  };
}

function evaluateEvidence(evidence) {
  if (evidence.status === "valid") {
    return { status: "pass", reasonCode: "executed", attempts: 1 };
  }
  if (evidence.status === "skipped") {
    return { status: "skipped", reasonCode: null, attempts: 0 };
  }
  if (evidence.status === "timeout") {
    return { status: "timeout", reasonCode: "validation_failed", attempts: 1 };
  }
  if (evidence.status === "retry_success") {
    return {
      status: "pass_after_retry",
      reasonCode: "executed",
      attempts: evidence?.retry?.attempts ?? 2,
      firstAttemptStatus: evidence?.retry?.first_attempt_status ?? "timeout",
      finalStatus: evidence?.retry?.final_status ?? "valid"
    };
  }

  throw new Error(`unsupported evidence status: ${evidence.status}`);
}

export function loadScenarioSuite(pathOrUrl = new URL("../fixtures/decision-loop-scenarios.v1.json", import.meta.url)) {
  return JSON.parse(fs.readFileSync(pathOrUrl, "utf8"));
}

export function simulateScenario(scenario, options = {}) {
  const seed = options.seed ?? "issue-166-decision-loop-v1";
  const generatedAt = options.generatedAtUtc ?? "2026-03-18T00:00:00Z";
  const correlationId = `corr-${scenario.id}-${stableHash(`${seed}:${scenario.id}`)}`;
  const decisionId = `dec-${stableHash(`${correlationId}:${scenario.issue.id}`, 12)}`;
  const baseContext = { decisionId, correlationId };
  const trace = [];
  const transitions = [];
  let currentState = DecisionState.REQUESTED;
  let minuteOffset = 0;

  trace.push(buildTraceEvent({
    at: isoAt(generatedAt, minuteOffset++),
    phase: "issue_ingest",
    status: "received",
    actor: scenario.issue.proposer_role,
    state: currentState,
    correlationId,
    detail: {
      issue_id: scenario.issue.id,
      action_class: scenario.issue.action_class,
      title: scenario.issue.title
    }
  }));

  const evaluating = applyTransition(
    currentState,
    DecisionState.EVALUATING,
    makeContext(baseContext, scenario.issue.proposer_role)
  );
  transitions.push(evaluating.transition);
  currentState = evaluating.state;

  trace.push(buildTraceEvent({
    at: isoAt(generatedAt, minuteOffset++),
    phase: "policy_decision",
    status: scenario.policy.outcome,
    actor: "policy_engine",
    state: currentState,
    correlationId,
    reasonCode: scenario.policy.reason_code,
    detail: {
      approvals_required: scenario.policy.approvals.required,
      approvals_received: scenario.policy.approvals.received,
      approvals_stale: scenario.policy.approvals.stale
    }
  }));

  const evidence = evaluateEvidence(scenario.evidence);
  const evidenceReasonCode = EVIDENCE_STATUS_REASON_CODE[scenario.evidence.status];
  const evidenceDetail = {
    attempts: evidence.attempts,
    freshness_hours: scenario.evidence.freshness_hours,
    same_commit_lineage: scenario.evidence.same_commit_lineage,
    artifacts: scenario.evidence.artifacts,
    ...(evidence.firstAttemptStatus ? { first_attempt_status: evidence.firstAttemptStatus } : {}),
    ...(evidence.finalStatus ? { final_status: evidence.finalStatus } : {})
  };

  if (scenario.evidence.status === "retry_success") {
    trace.push(buildTraceEvent({
      at: isoAt(generatedAt, minuteOffset++),
      phase: "evidence_validation",
      status: evidence.firstAttemptStatus ?? "timeout",
      actor: "evidence_validator",
      state: currentState,
      correlationId,
      reasonCode: "validation_failed",
      detail: {
        attempt: 1,
        attempts_total: evidence.attempts,
        freshness_hours: scenario.evidence.freshness_hours,
        same_commit_lineage: scenario.evidence.same_commit_lineage,
        artifacts: scenario.evidence.artifacts,
        next_action: "retry"
      }
    }));

    trace.push(buildTraceEvent({
      at: isoAt(generatedAt, minuteOffset++),
      phase: "evidence_retry",
      status: "retry_success",
      actor: "evidence_validator",
      state: currentState,
      correlationId,
      reasonCode: evidenceReasonCode,
      detail: {
        attempt: evidence.attempts,
        attempts_total: evidence.attempts,
        recovered_from: evidence.firstAttemptStatus ?? "timeout",
        final_status: evidence.finalStatus ?? "valid",
        freshness_hours: scenario.evidence.freshness_hours,
        same_commit_lineage: scenario.evidence.same_commit_lineage,
        artifacts: scenario.evidence.artifacts
      }
    }));
  } else {
    trace.push(buildTraceEvent({
      at: isoAt(generatedAt, minuteOffset++),
      phase: "evidence_validation",
      status: evidence.status,
      actor: "evidence_validator",
      state: currentState,
      correlationId,
      reasonCode: evidenceReasonCode,
      detail: evidenceDetail
    }));
  }

  const launchReasonCode = scenario.launch.reason_code ?? (scenario.launch.decision === "go" ? evidence.reasonCode ?? scenario.policy.reason_code : scenario.policy.reason_code ?? evidence.reasonCode);
  const launchState = LAUNCH_DECISION_TO_STATE[scenario.launch.decision];
  const verdict = applyTransition(
    currentState,
    launchState,
    makeContext(baseContext, "launch_gate", launchReasonCode, scenario.evidence.artifacts)
  );
  transitions.push(verdict.transition);
  currentState = verdict.state;

  trace.push(buildTraceEvent({
    at: isoAt(generatedAt, minuteOffset++),
    phase: "launch_verdict",
    status: scenario.launch.decision,
    actor: "launch_gate",
    state: currentState,
    correlationId,
    reasonCode: launchReasonCode,
    detail: {
      policy_outcome: scenario.policy.outcome,
      evidence_status: evidence.status
    }
  }));

  const recorded = applyTransition(
    currentState,
    DecisionState.RECORDED,
    makeContext(
      baseContext,
      "decision_recorder",
      launchReasonCode,
      scenario.evidence.artifacts
    )
  );
  transitions.push(recorded.transition);
  currentState = recorded.state;

  return {
    scenario_id: scenario.id,
    title: scenario.title,
    correlation_id: correlationId,
    decision_id: decisionId,
    seed,
    issue: scenario.issue,
    policy: scenario.policy,
    evidence: {
      ...scenario.evidence,
      evaluation: evidence
    },
    launch: {
      decision: scenario.launch.decision,
      reason_code: launchReasonCode
    },
    final_state: currentState,
    transitions,
    trace
  };
}

export function buildSimulationReport(suite, options = {}) {
  const registry = loadReasonCodeRegistry();
  const scenarios = suite.scenarios.map((scenario) => simulateScenario(scenario, {
    seed: options.seed ?? suite.seed,
    generatedAtUtc: options.generatedAtUtc ?? suite.generated_at_utc
  }));

  return {
    suite_version: suite.suite_version,
    seed: options.seed ?? suite.seed,
    generated_at_utc: options.generatedAtUtc ?? suite.generated_at_utc,
    registry_version: registry.version,
    total_scenarios: scenarios.length,
    scenario_matrix: scenarios.map((scenario) => ({
      scenario_id: scenario.scenario_id,
      final_state: scenario.final_state,
      launch_decision: scenario.launch.decision,
      launch_reason_code: scenario.launch.reason_code,
      trace_events: scenario.trace.length,
      transitions: scenario.transitions
    })),
    reason_code_counts: scenarios.reduce((acc, scenario) => {
      const code = scenario.launch.reason_code;
      acc[code] = (acc[code] ?? 0) + 1;
      return acc;
    }, {}),
    scenarios
  };
}

export function renderSimulationMarkdown(report) {
  const lines = [
    "# decision loop simulation report",
    "",
    `- suite_version: ${report.suite_version}`,
    `- seed: ${report.seed}`,
    `- generated_at_utc: ${report.generated_at_utc}`,
    `- registry_version: ${report.registry_version}`,
    `- total_scenarios: ${report.total_scenarios}`,
    "",
    "## scenario matrix",
    "| scenario_id | final_state | launch_decision | reason_code | trace_events |",
    "|---|---|---|---|---|"
  ];

  for (const scenario of report.scenario_matrix) {
    lines.push(`| ${scenario.scenario_id} | ${scenario.final_state} | ${scenario.launch_decision} | ${scenario.launch_reason_code} | ${scenario.trace_events} |`);
  }

  lines.push("", "## trace highlights");

  for (const scenario of report.scenarios) {
    lines.push(`### ${scenario.scenario_id}`);
    lines.push(`- correlation_id: \`${scenario.correlation_id}\``);
    lines.push(`- decision_id: \`${scenario.decision_id}\``);
    lines.push(`- transitions: ${scenario.transitions.join(" -> ")}`);
    lines.push(`- launch: **${scenario.launch.decision}** (${scenario.launch.reason_code})`);
    for (const event of scenario.trace) {
      lines.push(`  - ${event.at} :: ${event.phase} :: ${event.status} :: state=${event.state} :: reason=${event.reason_code ?? "n/a"}`);
    }
    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}
