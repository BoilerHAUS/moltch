const PANE_STATES = Object.freeze({
  LOADING: 'loading',
  DATA: 'data',
  EMPTY: 'empty',
  ERROR: 'error'
});

const TREASURY_STATES = Object.freeze([
  'submitted',
  'under_review',
  'approved',
  'executed',
  'failed'
]);

const ALLOWED_TREASURY_TRANSITIONS = Object.freeze({
  submitted: ['under_review', 'failed'],
  under_review: ['approved', 'failed'],
  approved: ['executed', 'failed'],
  executed: [],
  failed: []
});

function resolvePaneState({ loading = false, error = null, items = null } = {}) {
  if (loading) return PANE_STATES.LOADING;
  if (error) return PANE_STATES.ERROR;
  if (!Array.isArray(items) || items.length === 0) return PANE_STATES.EMPTY;
  return PANE_STATES.DATA;
}

function selectThread(currentState, nextThreadId) {
  const previousThreadId = currentState?.selectedThreadId ?? null;
  const hasChanged = previousThreadId !== nextThreadId;

  return {
    selectedThreadId: nextThreadId,
    tasksPane: {
      sourceOfTruth: 'threads.selectedThreadId',
      threadId: nextThreadId,
      shouldRefresh: hasChanged,
      updateOrder: ['threads.selectedThreadId', 'tasks.loading', 'tasks.fetch', 'tasks.render']
    }
  };
}

function isTreasuryTransitionAllowed(fromState, toState) {
  if (!TREASURY_STATES.includes(fromState) || !TREASURY_STATES.includes(toState)) {
    return false;
  }
  return ALLOWED_TREASURY_TRANSITIONS[fromState].includes(toState);
}

module.exports = {
  PANE_STATES,
  TREASURY_STATES,
  ALLOWED_TREASURY_TRANSITIONS,
  resolvePaneState,
  selectThread,
  isTreasuryTransitionAllowed
};
