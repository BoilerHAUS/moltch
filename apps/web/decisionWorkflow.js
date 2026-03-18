const DECISION_REASON_CODES = {
  go: ['evidence_complete', 'risk_accepted', 'pilot_ready'],
  hold: ['evidence_pending', 'manual_review_required', 'dependency_blocked'],
  'no-go': ['policy_violation', 'critical_risk', 'missing_controls']
};

function getReasonCodeOptions(verdict) {
  return DECISION_REASON_CODES[verdict] || [];
}

function validateDecisionSubmission({ role, decision, form }) {
  const errors = [];
  if (!decision) {
    errors.push('select a pending decision before submitting');
    return errors;
  }

  if (decision.status && decision.status !== 'pending') {
    errors.push('selected decision is no longer pending');
  }
  if (!form.verdict) {
    errors.push('select a verdict: go, hold, or no-go');
  }

  const allowedReasonCodes = getReasonCodeOptions(form.verdict);
  if (!form.reasonCode) {
    errors.push('select a reason code');
  } else if (!allowedReasonCodes.includes(form.reasonCode)) {
    errors.push('reason code does not match selected verdict');
  }

  const requiredRole = decision.roleRequired || 'approver';
  if (role !== requiredRole) {
    errors.push(`selected decision requires ${requiredRole} role`);
  }

  return errors;
}

const api = {
  DECISION_REASON_CODES,
  getReasonCodeOptions,
  validateDecisionSubmission
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = api;
}

if (typeof window !== 'undefined') {
  window.DecisionWorkflow = api;
}
