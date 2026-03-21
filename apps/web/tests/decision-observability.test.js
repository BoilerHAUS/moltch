const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  emitDecisionTransitionEvent,
  deriveDecisionMetrics,
  computeLatencyMs
} = require('../decisionObservability');

function loadFixture(name) {
  const file = path.join(__dirname, 'fixtures', name);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function run() {
  const emitted = emitDecisionTransitionEvent({
    eventId: 'evt-alpha-2',
    correlationId: 'corr-alpha',
    decisionId: 'dec-alpha',
    previousTimestampUtc: '2026-03-21T00:00:00Z',
    emittedAtUtc: '2026-03-21T00:00:03Z',
    fromState: 'proposed',
    toState: 'under_review',
    reasonCode: 'admissibility_passed',
    actorRole: 'agent_reviewer',
    lane: 'core',
    result: 'success'
  });

  assert.equal(emitted.event_version, 'decision_event.v1');
  assert.equal(emitted.latency_ms, 3000);
  assert.equal(computeLatencyMs('2026-03-21T00:00:00Z', '2026-03-21T00:00:05Z'), 5000);

  assert.throws(
    () => emitDecisionTransitionEvent({
      eventId: 'evt-bad',
      correlationId: 'corr-alpha',
      decisionId: 'dec-alpha',
      previousTimestampUtc: '2026-03-21T00:00:00Z',
      emittedAtUtc: '2026-03-20T23:59:59Z',
      fromState: 'under_review',
      toState: 'under_review',
      reasonCode: 'validation_failed',
      actorRole: 'agent_reviewer',
      lane: 'core',
      result: 'success'
    }),
    /from_state must differ/
  );

  const fixture = loadFixture('decision-observability-fixture.json');
  const resultA = deriveDecisionMetrics(fixture.events, fixture.options);
  const resultB = deriveDecisionMetrics(fixture.events, fixture.options);

  const mismatchFixture = loadFixture('decision-observability-correlation-mismatch.json');
  assert.throws(
    () => deriveDecisionMetrics(mismatchFixture.events),
    /correlation_id invariant violated/
  );

  assert.deepEqual(resultA, resultB);
  assert.equal(resultA.events.length, 10, 'duplicate event_id should be deduped');
  assert.equal(resultA.aggregate.decision_latency_ms.terminal_count, 3);
  assert.equal(resultA.aggregate.hold_rate, 1 / 3);
  assert.equal(resultA.aggregate.retry_rate, 1 / 3);
  assert.equal(resultA.aggregate.missing_artifact_catch_rate, 1 / 4);
  assert.equal(resultA.aggregate.no_go_rate, 1 / 3);

  const alpha = resultA.decisions.find((entry) => entry.decisionId === 'dec-alpha');
  const beta = resultA.decisions.find((entry) => entry.decisionId === 'dec-beta');
  const gamma = resultA.decisions.find((entry) => entry.decisionId === 'dec-gamma');

  assert.equal(alpha.attempts, 2, 'retry path should increment attempts > 1');
  assert.equal(beta.validationFailures, 2, 'validation failure burst should remain observable');
  assert.equal(gamma.terminalResult, 'no_go');
  assert.equal(alpha.correlationId, 'corr-alpha');
  assert.equal(beta.correlationId, 'corr-beta');

  const stuckAlert = resultA.alerts.find((entry) => entry.alert_name === 'decision_stuck_age_breach');
  const validationAlert = resultA.alerts.find((entry) => entry.alert_name === 'validation_failures_repeating_by_lane');
  const spikeAlert = resultA.alerts.find((entry) => entry.alert_name === 'hold_or_no_go_spike_vs_baseline' && entry.result === 'no_go');

  assert.ok(stuckAlert, 'expected stuck-age alert');
  assert.ok(validationAlert, 'expected repeated validation failure alert');
  assert.ok(spikeAlert, 'expected no_go spike alert');

  console.log('[decision-observability][pass] deterministic event emission and metric derivation contract locked');
}

run();
