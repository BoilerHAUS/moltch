import crypto from "node:crypto";

export const AUDIT_EVENT_SCHEMA = Object.freeze({
  name: "PolicyDecisionAuditEventV1",
  version: "1.0.0",
  lifecycle: Object.freeze([
    "requested",
    "evaluating",
    "go",
    "hold",
    "no_go",
    "recorded"
  ]),
  requiredFields: Object.freeze([
    "schema_version",
    "event_id",
    "event_type",
    "decision_id",
    "correlation_id",
    "lifecycle_state",
    "verdict",
    "reason_codes",
    "actor_ids",
    "timestamp",
    "input_digest"
  ])
});

export const DUAL_WRITE_FAILURE_MODE = Object.freeze({
  FAIL_OPEN: "fail_open",
  FAIL_CLOSED: "fail_closed"
});

export const AUDIT_WRITE_STATUS = Object.freeze({
  WRITTEN: "written",
  SKIPPED: "skipped",
  REPLAYED: "replayed"
});

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

export function computeDigest(value) {
  return crypto.createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex");
}

export function parseFeatureFlag(value) {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return false;
  return ["1", "true", "yes", "on", "enabled"].includes(value.trim().toLowerCase());
}

export function normalizeReasonCodes(reasonCodes = []) {
  return [...new Set((reasonCodes ?? []).filter(Boolean))].sort();
}

export function normalizeActorIds(actorIds = []) {
  return [...new Set((actorIds ?? []).filter(Boolean))].sort();
}

function required(name, value) {
  if (value === null || value === undefined || value === "") {
    throw new Error(`ERR_REQUIRED_${name.toUpperCase()}`);
  }
  return value;
}

export function createDecisionAuditRecord(input) {
  const decisionId = required("decision_id", input?.decisionId);
  const correlationId = required("correlation_id", input?.correlationId);
  const lifecycleState = required("lifecycle_state", input?.lifecycleState);
  const verdict = required("verdict", input?.verdict);
  const timestamp = required("timestamp", input?.timestamp);
  const reasonCodes = normalizeReasonCodes(input?.reasonCodes);
  const actorIds = normalizeActorIds(input?.actorIds);

  if (!reasonCodes.length) throw new Error("ERR_REQUIRED_REASON_CODES");
  if (!actorIds.length) throw new Error("ERR_REQUIRED_ACTOR_IDS");

  const decisionInput = canonicalize(input?.decisionInput ?? null);
  const inputDigest = computeDigest(decisionInput);

  return {
    schema_version: AUDIT_EVENT_SCHEMA.version,
    decision_id: decisionId,
    correlation_id: correlationId,
    lifecycle_state: lifecycleState,
    verdict,
    reason_codes: reasonCodes,
    actor_ids: actorIds,
    timestamp,
    decision_input: decisionInput,
    input_digest: inputDigest,
    offchain_log_id: input?.offchainLogId ?? null,
    metadata: canonicalize(input?.metadata ?? {})
  };
}

export function createOnChainAuditEvent(record, overrides = {}) {
  const normalized = createDecisionAuditRecord({
    decisionId: record?.decision_id ?? record?.decisionId,
    correlationId: record?.correlation_id ?? record?.correlationId,
    lifecycleState: record?.lifecycle_state ?? record?.lifecycleState,
    verdict: record?.verdict,
    reasonCodes: record?.reason_codes ?? record?.reasonCodes,
    actorIds: record?.actor_ids ?? record?.actorIds,
    timestamp: record?.timestamp,
    decisionInput: record?.decision_input ?? record?.decisionInput,
    offchainLogId: record?.offchain_log_id ?? record?.offchainLogId,
    metadata: record?.metadata
  });

  const eventId = overrides.eventId ?? computeDigest({
    schema_version: normalized.schema_version,
    decision_id: normalized.decision_id,
    lifecycle_state: normalized.lifecycle_state,
    verdict: normalized.verdict,
    input_digest: normalized.input_digest,
    timestamp: normalized.timestamp
  });

  return {
    schema_version: normalized.schema_version,
    event_id: eventId,
    event_type: "policy.decision.audit",
    decision_id: normalized.decision_id,
    correlation_id: normalized.correlation_id,
    lifecycle_state: normalized.lifecycle_state,
    verdict: normalized.verdict,
    reason_codes: normalized.reason_codes,
    actor_ids: normalized.actor_ids,
    timestamp: normalized.timestamp,
    input_digest: normalized.input_digest,
    offchain_log_id: normalized.offchain_log_id,
    metadata: normalized.metadata
  };
}

export function assertAuditParity(record, event) {
  const pairs = [
    ["schema_version", record?.schema_version, event?.schema_version],
    ["decision_id", record?.decision_id, event?.decision_id],
    ["correlation_id", record?.correlation_id, event?.correlation_id],
    ["lifecycle_state", record?.lifecycle_state, event?.lifecycle_state],
    ["verdict", record?.verdict, event?.verdict],
    ["reason_codes", record?.reason_codes, event?.reason_codes],
    ["actor_ids", record?.actor_ids, event?.actor_ids],
    ["timestamp", record?.timestamp, event?.timestamp],
    ["input_digest", record?.input_digest, event?.input_digest],
    ["offchain_log_id", record?.offchain_log_id, event?.offchain_log_id]
  ];

  for (const [field, left, right] of pairs) {
    if (JSON.stringify(left) !== JSON.stringify(right)) {
      const err = new Error(`ERR_AUDIT_PARITY_MISMATCH:${field}`);
      err.code = "ERR_AUDIT_PARITY_MISMATCH";
      err.field = field;
      throw err;
    }
  }

  return true;
}

export function buildDualWriteIdempotencyKey(record) {
  return computeDigest({
    schema_version: record.schema_version,
    decision_id: record.decision_id,
    lifecycle_state: record.lifecycle_state,
    verdict: record.verdict,
    timestamp: record.timestamp,
    input_digest: record.input_digest
  });
}

export function createMemoryIdempotencyStore() {
  const seen = new Map();
  return {
    has(key) {
      return seen.has(key);
    },
    get(key) {
      return seen.get(key) ?? null;
    },
    set(key, value) {
      seen.set(key, value);
    }
  };
}

export function createMemorySink(name) {
  const writes = [];
  return {
    name,
    writes,
    async write(payload) {
      writes.push(payload);
      return { sink: name, status: AUDIT_WRITE_STATUS.WRITTEN, write_count: writes.length };
    }
  };
}

export function createAuditDualWriter(options = {}) {
  const featureFlagName = options.featureFlagName ?? "MOLTCH_AUDIT_DUAL_WRITE_ENABLED";
  const offchainSink = options.offchainSink;
  const onchainEmitter = options.onchainEmitter;
  const idempotencyStore = options.idempotencyStore ?? createMemoryIdempotencyStore();
  const onchainFailureMode = options.onchainFailureMode ?? DUAL_WRITE_FAILURE_MODE.FAIL_OPEN;

  if (!offchainSink?.write) throw new Error("ERR_OFFCHAIN_SINK_REQUIRED");
  if (!onchainEmitter?.write) throw new Error("ERR_ONCHAIN_EMITTER_REQUIRED");

  return {
    featureFlagName,
    onchainFailureMode,
    isDualWriteEnabled(runtime = {}) {
      const source = runtime.flags?.[featureFlagName] ?? runtime.env?.[featureFlagName] ?? false;
      return parseFeatureFlag(source);
    },
    async write(input, runtime = {}) {
      const record = createDecisionAuditRecord(input);
      const event = createOnChainAuditEvent(record);
      assertAuditParity(record, event);

      const idempotencyKey = buildDualWriteIdempotencyKey(record);
      if (idempotencyStore.has(idempotencyKey)) {
        return {
          status: AUDIT_WRITE_STATUS.REPLAYED,
          dual_write_enabled: this.isDualWriteEnabled(runtime),
          idempotency_key: idempotencyKey,
          record,
          event,
          sinks: idempotencyStore.get(idempotencyKey)
        };
      }

      const offchain = await offchainSink.write(record, { idempotencyKey, runtime });
      const dualWriteEnabled = this.isDualWriteEnabled(runtime);
      let onchain = { status: AUDIT_WRITE_STATUS.SKIPPED, reason: "feature_flag_disabled" };

      if (dualWriteEnabled) {
        try {
          onchain = await onchainEmitter.write(event, { idempotencyKey, runtime });
        } catch (error) {
          if (onchainFailureMode === DUAL_WRITE_FAILURE_MODE.FAIL_CLOSED) {
            throw error;
          }
          onchain = {
            status: AUDIT_WRITE_STATUS.SKIPPED,
            reason: "onchain_emit_failed_fail_open",
            error: error.message
          };
        }
      }

      const result = { offchain, onchain };
      idempotencyStore.set(idempotencyKey, result);

      return {
        status: AUDIT_WRITE_STATUS.WRITTEN,
        dual_write_enabled: dualWriteEnabled,
        idempotency_key: idempotencyKey,
        record,
        event,
        sinks: result
      };
    }
  };
}
