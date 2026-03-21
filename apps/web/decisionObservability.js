const NON_TERMINAL_STATES = new Set(['draft', 'proposed', 'under_review', 'approved', 'paused_blocked']);
const TERMINAL_STATES = new Set(['executed', 'rejected', 'expired', 'cancelled']);
const ALLOWED_RESULTS = new Set(['success', 'hold', 'no_go', 'error']);
const VALIDATION_REASON_CODES = new Set(['validation_failed', 'artifact_missing', 'evidence_missing']);

function parseUtcIsoToMillis(value) {
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) {
    throw new Error(`invalid UTC timestamp: ${value}`);
  }
  return ms;
}

function normalizeUtcIso(value) {
  return new Date(parseUtcIsoToMillis(value)).toISOString();
}

function computeLatencyMs(previousTimestampUtc, emittedAtUtc) {
  const prev = parseUtcIsoToMillis(previousTimestampUtc);
  const next = parseUtcIsoToMillis(emittedAtUtc);
  const latencyMs = next - prev;
  if (latencyMs < 0) {
    throw new Error('latency_ms must be >= 0');
  }
  return latencyMs;
}

function emitDecisionTransitionEvent({
  eventId,
  correlationId,
  decisionId,
  previousTimestampUtc,
  emittedAtUtc,
  fromState,
  toState,
  reasonCode,
  actorRole,
  lane,
  result
}) {
  if (!eventId) throw new Error('event_id required');
  if (!correlationId) throw new Error('correlation_id required');
  if (!decisionId) throw new Error('decision_id required');
  if (!reasonCode) throw new Error('reason_code required');
  if (!actorRole) throw new Error('actor_role required');
  if (!lane) throw new Error('lane required');
  if (!fromState) throw new Error('from_state required');
  if (!toState) throw new Error('to_state required');
  if (fromState === toState) throw new Error('from_state must differ from to_state');
  if (!ALLOWED_RESULTS.has(result)) throw new Error(`unknown result: ${result}`);

  return {
    event_id: eventId,
    event_version: 'decision_event.v1',
    emitted_at_utc: normalizeUtcIso(emittedAtUtc),
    correlation_id: correlationId,
    decision_id: decisionId,
    from_state: fromState,
    to_state: toState,
    reason_code: reasonCode,
    actor_role: actorRole,
    lane,
    result,
    latency_ms: computeLatencyMs(previousTimestampUtc, emittedAtUtc)
  };
}

function dedupeEvents(events) {
  const seen = new Set();
  const output = [];
  for (const event of events) {
    if (seen.has(event.event_id)) continue;
    seen.add(event.event_id);
    output.push(event);
  }
  return output;
}

function sortEvents(events) {
  return [...events].sort((a, b) => {
    const delta = parseUtcIsoToMillis(a.emitted_at_utc) - parseUtcIsoToMillis(b.emitted_at_utc);
    if (delta !== 0) return delta;
    return a.event_id.localeCompare(b.event_id);
  });
}

function deriveDecisionMetrics(events, options = {}) {
  const baselineMultiplier = options.baselineMultiplier ?? 2;
  const baseline = options.baseline ?? {};
  const uniqueEvents = sortEvents(dedupeEvents(events));
  const decisionMap = new Map();
  const validationFailureCountsByLane = new Map();
  const terminalCountsByLane = new Map();
  const holdCountsByLane = new Map();
  const noGoCountsByLane = new Map();

  for (const event of uniqueEvents) {
    if (event.event_version !== 'decision_event.v1') {
      throw new Error(`unsupported event_version: ${event.event_version}`);
    }
    if (!ALLOWED_RESULTS.has(event.result)) {
      throw new Error(`unknown result: ${event.result}`);
    }
    if (event.from_state === event.to_state) {
      throw new Error('from_state must differ from to_state');
    }
    if (!event.correlation_id || !event.decision_id) {
      throw new Error('decision observability events require stable ids');
    }

    const entry = decisionMap.get(event.decision_id) || {
      decisionId: event.decision_id,
      correlationId: event.correlation_id,
      lane: event.lane,
      attempts: 0,
      validationFailures: 0,
      totalLatencyMs: 0,
      terminalResult: null,
      lastState: null,
      stateEnteredAtUtc: null,
      eventIds: []
    };

    entry.correlationId = event.correlation_id;
    entry.lane = event.lane;
    entry.totalLatencyMs += event.latency_ms;
    entry.lastState = event.to_state;
    entry.stateEnteredAtUtc = event.emitted_at_utc;
    entry.eventIds.push(event.event_id);

    if (event.to_state === 'proposed') {
      entry.attempts += 1;
    }
    if (VALIDATION_REASON_CODES.has(event.reason_code)) {
      entry.validationFailures += 1;
      validationFailureCountsByLane.set(event.lane, (validationFailureCountsByLane.get(event.lane) || 0) + 1);
    }
    if (TERMINAL_STATES.has(event.to_state)) {
      entry.terminalResult = event.result;
      terminalCountsByLane.set(event.lane, (terminalCountsByLane.get(event.lane) || 0) + 1);
      if (event.result === 'hold') {
        holdCountsByLane.set(event.lane, (holdCountsByLane.get(event.lane) || 0) + 1);
      }
      if (event.result === 'no_go') {
        noGoCountsByLane.set(event.lane, (noGoCountsByLane.get(event.lane) || 0) + 1);
      }
    }

    decisionMap.set(event.decision_id, entry);
  }

  const decisions = Array.from(decisionMap.values()).sort((a, b) => a.decisionId.localeCompare(b.decisionId));
  const terminalDecisions = decisions.filter((entry) => entry.terminalResult !== null);
  const terminalLatencies = terminalDecisions.map((entry) => entry.totalLatencyMs).sort((a, b) => a - b);

  const aggregate = {
    decision_latency_ms: {
      terminal_count: terminalDecisions.length,
      average: terminalLatencies.length ? terminalLatencies.reduce((sum, value) => sum + value, 0) / terminalLatencies.length : 0,
      p50: percentile(terminalLatencies, 0.5),
      p95: percentile(terminalLatencies, 0.95)
    },
    hold_rate: rate(terminalDecisions.filter((entry) => entry.terminalResult === 'hold').length, terminalDecisions.length),
    no_go_rate: rate(terminalDecisions.filter((entry) => entry.terminalResult === 'no_go').length, terminalDecisions.length),
    missing_artifact_catch_rate: rate(
      uniqueEvents.filter((event) => event.reason_code === 'artifact_missing' || event.reason_code === 'evidence_missing').length,
      uniqueEvents.filter((event) => event.reason_code === 'artifact_missing' || event.reason_code === 'evidence_missing' || event.reason_code === 'validation_failed' || event.reason_code === 'admissibility_passed').length
    ),
    retry_rate: rate(decisions.filter((entry) => entry.attempts > 1).length, terminalDecisions.length || decisions.length)
  };

  const alerts = [];
  for (const decision of decisions) {
    const thresholdMs = options.stuckAgeThresholdMs ?? 30 * 60 * 1000;
    if (NON_TERMINAL_STATES.has(decision.lastState)) {
      const asOfUtc = normalizeUtcIso(options.asOfUtc || decision.stateEnteredAtUtc);
      const ageMs = parseUtcIsoToMillis(asOfUtc) - parseUtcIsoToMillis(decision.stateEnteredAtUtc);
      if (ageMs > thresholdMs) {
        alerts.push({
          alert_name: 'decision_stuck_age_breach',
          severity: 'sev2',
          owner_role: 'agent_technical_delivery',
          decision_id: decision.decisionId,
          correlation_id: decision.correlationId,
          lane: decision.lane,
          current_state: decision.lastState,
          age_ms: ageMs,
          last_reason_code: null,
          runbook_ref: 'docs/operations/DECISION_INCIDENT_TRIAGE_RUNBOOK_V1.md'
        });
      }
    }
  }

  for (const [lane, count] of validationFailureCountsByLane.entries()) {
    const threshold = options.validationFailureThreshold ?? 3;
    if (count >= threshold) {
      alerts.push({
        alert_name: 'validation_failures_repeating_by_lane',
        severity: 'sev3',
        owner_role: 'agent_technical_delivery',
        lane,
        count_in_window: count,
        affected_decision_count: decisions.filter((entry) => entry.lane === lane && entry.validationFailures > 0).length,
        runbook_ref: 'docs/operations/DECISION_INCIDENT_TRIAGE_RUNBOOK_V1.md'
      });
    }
  }

  for (const [lane, terminalCount] of terminalCountsByLane.entries()) {
    const holdRate = rate(holdCountsByLane.get(lane) || 0, terminalCount);
    const noGoRate = rate(noGoCountsByLane.get(lane) || 0, terminalCount);
    const holdBaseline = baseline[`${lane}:hold_rate`] ?? 0;
    const noGoBaseline = baseline[`${lane}:no_go_rate`] ?? 0;
    if (holdBaseline > 0 && holdRate >= holdBaseline * baselineMultiplier) {
      alerts.push({
        alert_name: 'hold_or_no_go_spike_vs_baseline',
        severity: 'sev3',
        owner_role: 'agent_product_governance',
        lane,
        result: 'hold',
        current_window_value: holdRate,
        baseline_value: holdBaseline,
        window_size: options.windowSize || 'n/a',
        runbook_ref: 'docs/operations/DECISION_INCIDENT_TRIAGE_RUNBOOK_V1.md'
      });
    }
    if (noGoBaseline > 0 && noGoRate >= noGoBaseline * baselineMultiplier) {
      alerts.push({
        alert_name: 'hold_or_no_go_spike_vs_baseline',
        severity: 'sev3',
        owner_role: 'agent_product_governance',
        lane,
        result: 'no_go',
        current_window_value: noGoRate,
        baseline_value: noGoBaseline,
        window_size: options.windowSize || 'n/a',
        runbook_ref: 'docs/operations/DECISION_INCIDENT_TRIAGE_RUNBOOK_V1.md'
      });
    }
  }

  return { events: uniqueEvents, decisions, aggregate, alerts };
}

function rate(numerator, denominator) {
  if (!denominator) return 0;
  return numerator / denominator;
}

function percentile(values, q) {
  if (!values.length) return 0;
  const idx = Math.ceil(values.length * q) - 1;
  return values[Math.max(0, Math.min(values.length - 1, idx))];
}

module.exports = {
  emitDecisionTransitionEvent,
  deriveDecisionMetrics,
  dedupeEvents,
  computeLatencyMs,
  NON_TERMINAL_STATES,
  TERMINAL_STATES,
  VALIDATION_REASON_CODES
};
