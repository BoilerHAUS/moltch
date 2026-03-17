const assert = require('node:assert/strict');
const { getReasonCodeOptions, validateDecisionSubmission } = require('../decisionWorkflow');

function run() {
  assert.deepEqual(getReasonCodeOptions('go'), ['evidence_complete', 'risk_accepted', 'pilot_ready']);
  assert.deepEqual(getReasonCodeOptions('hold'), ['evidence_pending', 'manual_review_required', 'dependency_blocked']);
  assert.deepEqual(getReasonCodeOptions('no-go'), ['policy_violation', 'critical_risk', 'missing_controls']);
  assert.deepEqual(getReasonCodeOptions('unknown'), []);

  const base = {
    role: 'approver',
    decision: { id: 'd1' },
    form: { verdict: 'go', reasonCode: 'evidence_complete' }
  };

  assert.deepEqual(validateDecisionSubmission(base), []);

  assert.ok(
    validateDecisionSubmission({ ...base, role: 'reviewer' }).includes('only approver role can submit final verdicts')
  );

  assert.ok(
    validateDecisionSubmission({ ...base, form: { verdict: '', reasonCode: '' } }).includes(
      'select a verdict: go, hold, or no-go'
    )
  );

  assert.ok(
    validateDecisionSubmission({ ...base, form: { verdict: 'hold', reasonCode: 'evidence_complete' } }).includes(
      'reason code does not match selected verdict'
    )
  );

  console.log('[decision-workflow][pass] validation and reason-code guardrails enforced');
}

run();
