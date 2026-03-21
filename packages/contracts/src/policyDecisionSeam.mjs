import crypto from "node:crypto";
import { DecisionVerdict, isValidReasonCode } from "./reasonCodes.mjs";

export function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        acc[key] = canonicalize(value[key]);
        return acc;
      }, {});
  }
  return value;
}

export function computeDecisionDigest(input) {
  const canonical = JSON.stringify(canonicalize(input));
  return crypto.createHash("sha256").update(canonical).digest("hex");
}

export function normalizeEvidenceRefs(refs = []) {
  return [...new Set(refs.filter(Boolean))].sort();
}

export function createDecisionRequest({ decisionId, correlationId, actor, evidenceRefs = [], payload }) {
  if (!decisionId || !correlationId || !actor) {
    throw new Error("ERR_REQUIRED_FIELDS_MISSING");
  }

  const normalized = {
    decisionId,
    correlationId,
    actor,
    evidenceRefs: normalizeEvidenceRefs(evidenceRefs),
    payload: payload ?? null
  };

  return {
    ...normalized,
    digest: computeDecisionDigest(normalized)
  };
}

export function evaluateDecision(request, { evaluator, verdict, reasonCode, notes = "" }) {
  if (!request?.digest) throw new Error("ERR_INVALID_REQUEST");
  if (!evaluator || !verdict || !reasonCode) throw new Error("ERR_REQUIRED_FIELDS_MISSING");
  if (!Object.values(DecisionVerdict).includes(verdict)) throw new Error("ERR_INVALID_VERDICT");
  if (!isValidReasonCode(reasonCode)) throw new Error("ERR_INVALID_REASON_CODE");

  return {
    decisionId: request.decisionId,
    correlationId: request.correlationId,
    requestDigest: request.digest,
    evaluator,
    verdict,
    reasonCode,
    notes
  };
}
