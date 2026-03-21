const assert = require('node:assert/strict');
const { getObservabilityPanelState, normalizeObservabilitySummary, normalizeCorrelation } = require('../observabilityPanel');

function run() {
  assert.equal(getObservabilityPanelState({ loading: true }), 'loading');
  assert.equal(getObservabilityPanelState({ error: 'boom' }), 'error');
  assert.equal(getObservabilityPanelState({ summary: { states: { empty: true } } }), 'empty');
  assert.equal(getObservabilityPanelState({ summary: { states: { empty: false } } }), 'data');

  const summary = normalizeObservabilitySummary({ source: 'fixture', items: [{ decision_id: 'dec-1' }] });
  assert.equal(summary.source, 'fixture');
  assert.equal(summary.items.length, 1);

  const correlation = normalizeCorrelation({ correlation_id: 'corr-1', state: 'available', events: [{ event_id: 'evt-1' }] });
  assert.equal(correlation.correlation_id, 'corr-1');
  assert.equal(correlation.events.length, 1);

  console.log('[observability-panel][pass] summary + correlation contract states locked');
}

run();
