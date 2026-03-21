const fs = require('fs');
const path = require('path');

function loadFixture() {
  const file = path.join(__dirname, 'fixtures', 'decision-observability.v1.json');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function getDecisionObservabilitySummary() {
  return loadFixture().summary;
}

function getDecisionObservabilityCorrelation(correlationId) {
  const fixture = loadFixture();
  return fixture.correlations[correlationId] || {
    version: 'decision_observability.correlation.v1',
    correlation_id: correlationId,
    state: 'unavailable',
    decision: null,
    events: []
  };
}

module.exports = { getDecisionObservabilitySummary, getDecisionObservabilityCorrelation };
