import test from "node:test";
import assert from "node:assert/strict";
import {
  AUDIT_WRITE_STATUS,
  DUAL_WRITE_FAILURE_MODE,
  assertAuditParity,
  createAuditDualWriter,
  createDecisionAuditRecord,
  createMemorySink,
  createOnChainAuditEvent,
  createMemoryIdempotencyStore
} from "../src/index.mjs";

function sampleInput() {
  return {
    decisionId: "dec-153",
    correlationId: "corr-153",
    lifecycleState: "recorded",
    verdict: "go",
    reasonCodes: ["executed", "executed"],
    actorIds: ["policy_engine", "launch_gate"],
    timestamp: "2026-03-18T09:30:00Z",
    decisionInput: {
      issue_id: 153,
      approvals_required: 1,
      approvals_received: 1,
      artifacts: ["run:123", "packet:abc"]
    },
    offchainLogId: "log-153"
  };
}

test("on-chain event preserves parity with the off-chain decision record", () => {
  const record = createDecisionAuditRecord(sampleInput());
  const event = createOnChainAuditEvent(record);

  assert.equal(assertAuditParity(record, event), true);
  assert.equal(event.event_type, "policy.decision.audit");
  assert.equal(event.schema_version, "1.0.0");
});

test("dual writer emits off-chain + on-chain payloads when feature flag is enabled", async () => {
  const offchainSink = createMemorySink("offchain");
  const onchainEmitter = createMemorySink("onchain");
  const writer = createAuditDualWriter({ offchainSink, onchainEmitter });

  const result = await writer.write(sampleInput(), {
    env: { MOLTCH_AUDIT_DUAL_WRITE_ENABLED: "true" }
  });

  assert.equal(result.status, AUDIT_WRITE_STATUS.WRITTEN);
  assert.equal(result.dual_write_enabled, true);
  assert.equal(offchainSink.writes.length, 1);
  assert.equal(onchainEmitter.writes.length, 1);
  assert.equal(assertAuditParity(offchainSink.writes[0], onchainEmitter.writes[0]), true);
});

test("dual writer is explicit opt-in and skips on-chain writes when feature flag is disabled", async () => {
  const offchainSink = createMemorySink("offchain");
  const onchainEmitter = createMemorySink("onchain");
  const writer = createAuditDualWriter({ offchainSink, onchainEmitter });

  const result = await writer.write(sampleInput(), {
    env: { MOLTCH_AUDIT_DUAL_WRITE_ENABLED: "false" }
  });

  assert.equal(result.dual_write_enabled, false);
  assert.equal(offchainSink.writes.length, 1);
  assert.equal(onchainEmitter.writes.length, 0);
  assert.equal(result.sinks.onchain.status, AUDIT_WRITE_STATUS.SKIPPED);
});

test("idempotency store collapses duplicate writes across both sinks", async () => {
  const offchainSink = createMemorySink("offchain");
  const onchainEmitter = createMemorySink("onchain");
  const writer = createAuditDualWriter({
    offchainSink,
    onchainEmitter,
    idempotencyStore: createMemoryIdempotencyStore()
  });

  const runtime = { env: { MOLTCH_AUDIT_DUAL_WRITE_ENABLED: "1" } };
  const first = await writer.write(sampleInput(), runtime);
  const second = await writer.write(sampleInput(), runtime);

  assert.equal(first.status, AUDIT_WRITE_STATUS.WRITTEN);
  assert.equal(second.status, AUDIT_WRITE_STATUS.REPLAYED);
  assert.equal(first.idempotency_key, second.idempotency_key);
  assert.equal(offchainSink.writes.length, 1);
  assert.equal(onchainEmitter.writes.length, 1);
});

test("fail-open keeps off-chain logging durable when on-chain emit fails", async () => {
  const offchainSink = createMemorySink("offchain");
  const onchainEmitter = {
    async write() {
      throw new Error("rpc unavailable");
    }
  };
  const writer = createAuditDualWriter({
    offchainSink,
    onchainEmitter,
    onchainFailureMode: DUAL_WRITE_FAILURE_MODE.FAIL_OPEN
  });

  const result = await writer.write(sampleInput(), {
    env: { MOLTCH_AUDIT_DUAL_WRITE_ENABLED: "yes" }
  });

  assert.equal(offchainSink.writes.length, 1);
  assert.equal(result.sinks.onchain.status, AUDIT_WRITE_STATUS.SKIPPED);
  assert.equal(result.sinks.onchain.reason, "onchain_emit_failed_fail_open");
});

test("fail-closed propagates on-chain emitter failures", async () => {
  const writer = createAuditDualWriter({
    offchainSink: createMemorySink("offchain"),
    onchainEmitter: {
      async write() {
        throw new Error("signer rejected");
      }
    },
    onchainFailureMode: DUAL_WRITE_FAILURE_MODE.FAIL_CLOSED
  });

  await assert.rejects(
    () => writer.write(sampleInput(), { env: { MOLTCH_AUDIT_DUAL_WRITE_ENABLED: "on" } }),
    /signer rejected/
  );
});
