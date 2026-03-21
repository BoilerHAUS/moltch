function getObservabilityPanelState({ loading = false, error = '', summary = null } = {}) {
  if (loading) return 'loading';
  if (error) return 'error';
  if (!summary) return 'unavailable';
  if (summary.states?.empty) return 'empty';
  return 'data';
}

function normalizeObservabilitySummary(summary) {
  return {
    source: summary?.source || 'unknown',
    fetched_at: summary?.fetched_at || 'n/a',
    totals: summary?.totals || { decisions: 0, terminal: 0, alerts: 0 },
    aggregate: summary?.aggregate || {},
    states: summary?.states || { loading: false, empty: true, unavailable: false, mock_mode: false },
    items: Array.isArray(summary?.items) ? summary.items : []
  };
}

function normalizeCorrelation(payload) {
  return {
    correlation_id: payload?.correlation_id || 'n/a',
    state: payload?.state || 'unavailable',
    decision: payload?.decision || null,
    events: Array.isArray(payload?.events) ? payload.events : []
  };
}

if (typeof module !== 'undefined') {
  module.exports = { getObservabilityPanelState, normalizeObservabilitySummary, normalizeCorrelation };
}
if (typeof window !== 'undefined') {
  window.ObservabilityPanel = { getObservabilityPanelState, normalizeObservabilitySummary, normalizeCorrelation };
}
