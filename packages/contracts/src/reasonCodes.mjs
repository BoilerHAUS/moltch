export const DecisionVerdict = Object.freeze({
  GO: "go",
  HOLD: "hold",
  NO_GO: "no_go"
});

export const DecisionReasonCode = Object.freeze({
  EVIDENCE_MISSING: "evidence.missing",
  EVIDENCE_INVALID: "evidence.invalid",
  POLICY_BLOCK: "policy.block",
  RISK_UNRESOLVED: "risk.unresolved",
  READY_FOR_RELEASE: "ready.for_release"
});

export function isValidReasonCode(code) {
  return Object.values(DecisionReasonCode).includes(code);
}
