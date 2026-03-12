const assert = require('node:assert/strict');
const {
  PANE_STATES,
  resolvePaneState,
  selectThread,
  isTreasuryTransitionAllowed
} = require('../paneContract');

function run() {
  // Pane state machine coverage
  assert.equal(resolvePaneState({ loading: true, items: [] }), PANE_STATES.LOADING);
  assert.equal(resolvePaneState({ error: 'timeout', items: [] }), PANE_STATES.ERROR);
  assert.equal(resolvePaneState({ items: [] }), PANE_STATES.EMPTY);
  assert.equal(resolvePaneState({ items: [{ id: 1 }] }), PANE_STATES.DATA);

  // Selection propagation boundary + update order
  const propagated = selectThread({ selectedThreadId: 'thread-63' }, 'thread-64');
  assert.equal(propagated.selectedThreadId, 'thread-64');
  assert.equal(propagated.tasksPane.sourceOfTruth, 'threads.selectedThreadId');
  assert.equal(propagated.tasksPane.threadId, 'thread-64');
  assert.equal(propagated.tasksPane.shouldRefresh, true);
  assert.deepEqual(propagated.tasksPane.updateOrder, [
    'threads.selectedThreadId',
    'tasks.loading',
    'tasks.fetch',
    'tasks.render'
  ]);

  // Treasury transition constraints
  assert.equal(isTreasuryTransitionAllowed('submitted', 'under_review'), true);
  assert.equal(isTreasuryTransitionAllowed('under_review', 'approved'), true);
  assert.equal(isTreasuryTransitionAllowed('approved', 'executed'), true);
  assert.equal(isTreasuryTransitionAllowed('submitted', 'executed'), false);
  assert.equal(isTreasuryTransitionAllowed('executed', 'under_review'), false);

  console.log('[pane-contract][pass] interaction contract checks passed');
}

run();
