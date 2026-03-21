import fs from "node:fs";
import crypto from "node:crypto";
import {
  OracleBridgeReasonCode,
  OracleBridgeState,
  applyOracleBridgeTransition,
  createOracleBridgeRequest
} from "./oracleBridge.mjs";

function stableHash(input, length = 10) {
  return crypto.createHash("sha256").update(String(input)).digest("hex").slice(0, length);
}

function isoAt(base, offsetMinutes) {
  const dt = new Date(base);
  dt.setUTCMinutes(dt.getUTCMinutes() + offsetMinutes);
  return dt.toISOString().replace('.000Z', 'Z');
}

function renderTraceEvent(at, phase, status, state, context) {
  return {
    at,
    phase,
    status,
    state,
    correlation_id: context.correlationId,
    bridge_request_id: context.bridgeRequestId,
    approval_id: context.approvalId ?? null,
    execution_id: context.executionId ?? null,
    decision_reason_code: context.decisionReasonCode ?? null,
    result_reason_code: context.resultReasonCode ?? null,
    attempt: context.attempt
  };
}

export function loadOracleBridgeScenarioSuite(pathOrUrl = new URL('../fixtures/oracle-bridge-scenarios.v1.json', import.meta.url)) {
  return JSON.parse(fs.readFileSync(pathOrUrl, 'utf8'));
}

export function simulateOracleBridgeScenario(scenario, options = {}) {
  const seed = options.seed ?? 'issue-155-oracle-bridge-v1';
  const generatedAt = options.generatedAtUtc ?? '2026-03-18T00:00:00Z';
  const request = createOracleBridgeRequest({
    bridgeRequestId: `obr-${scenario.id}-${stableHash(`${seed}:${scenario.id}`)}`,
    correlationId: `corr-${scenario.id}-${stableHash(`${seed}:${scenario.id}:corr`)}`,
    decisionId: `dec-${stableHash(`${scenario.issue_id}:${scenario.id}`, 12)}`,
    actor: scenario.request.actor,
    maxAttempts: scenario.request.max_attempts,
    timeoutSeconds: scenario.request.timeout_seconds,
    evidenceRefs: scenario.request.evidence_refs,
    metadata: {
      issue_id: scenario.issue_id,
      scenario_id: scenario.id
    }
  });

  const transitions = [];
  const trace = [];
  let currentState = OracleBridgeState.REQUESTED;
  let minuteOffset = 0;

  for (const event of scenario.events) {
    const applied = applyOracleBridgeTransition(currentState, event.next_state, {
      ...request,
      actor: event.actor,
      approvalId: event.approval_id,
      executionId: event.execution_id,
      decisionReasonCode: event.decision_reason_code,
      resultReasonCode: event.result_reason_code,
      resultRefs: event.result_refs,
      attempt: event.attempt ?? 1,
      maxAttempts: request.maxAttempts
    });
    transitions.push(applied.transition);
    trace.push(
      renderTraceEvent(
        isoAt(generatedAt, minuteOffset++),
        event.phase,
        event.status,
        applied.state,
        applied.context
      )
    );
    currentState = applied.state;
  }

  return {
    scenario_id: scenario.id,
    issue_id: scenario.issue_id,
    title: scenario.title,
    final_state: currentState,
    transitions,
    correlation_id: request.correlationId,
    bridge_request_id: request.bridgeRequestId,
    decision_id: request.decisionId,
    trace
  };
}

export function buildOracleBridgeSimulationReport(suite, options = {}) {
  const scenarios = suite.scenarios.map((scenario) => simulateOracleBridgeScenario(scenario, options));
  return {
    suite_version: suite.suite_version,
    seed: options.seed ?? suite.seed,
    generated_at_utc: options.generatedAtUtc ?? suite.generated_at_utc,
    total_scenarios: scenarios.length,
    scenarios,
    scenario_matrix: scenarios.map((scenario) => ({
      scenario_id: scenario.scenario_id,
      final_state: scenario.final_state,
      transitions: scenario.transitions,
      trace_events: scenario.trace.length
    }))
  };
}

export function renderOracleBridgeSimulationMarkdown(report) {
  const lines = [
    '# oracle bridge simulation report',
    '',
    `- suite_version: ${report.suite_version}`,
    `- seed: ${report.seed}`,
    `- generated_at_utc: ${report.generated_at_utc}`,
    `- total_scenarios: ${report.total_scenarios}`,
    '',
    '## scenario matrix',
    '| scenario_id | final_state | trace_events |',
    '|---|---|---|'
  ];

  for (const scenario of report.scenario_matrix) {
    lines.push(`| ${scenario.scenario_id} | ${scenario.final_state} | ${scenario.trace_events} |`);
  }

  lines.push('', '## trace highlights');
  for (const scenario of report.scenarios) {
    lines.push(`### ${scenario.scenario_id}`);
    lines.push(`- correlation_id: \`${scenario.correlation_id}\``);
    lines.push(`- bridge_request_id: \`${scenario.bridge_request_id}\``);
    lines.push(`- decision_id: \`${scenario.decision_id}\``);
    lines.push(`- transitions: ${scenario.transitions.join(' -> ')}`);
    for (const event of scenario.trace) {
      lines.push(`  - ${event.at} :: ${event.phase} :: ${event.status} :: state=${event.state} :: approval=${event.approval_id ?? 'n/a'} :: execution=${event.execution_id ?? 'n/a'}`);
    }
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}
