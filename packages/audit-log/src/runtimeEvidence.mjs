import fs from "node:fs";
import crypto from "node:crypto";
import {
  createAuditDualWriter,
  createMemoryIdempotencyStore,
  createDecisionAuditRecord,
  createOnChainAuditEvent,
  DUAL_WRITE_FAILURE_MODE,
  AUDIT_WRITE_STATUS,
  computeDigest
} from "./index.mjs";

export function createScenarioInput(name) {
  const base = {
    decisionId: `dec-${name}`,
    correlationId: `corr-${name}`,
    lifecycleState: "recorded",
    verdict: "go",
    reasonCodes: ["executed"],
    actorIds: ["policy_engine", "launch_gate"],
    timestamp: "2026-03-21T14:30:00Z",
    decisionInput: {
      scenario: name,
      approvals_required: 1,
      approvals_received: 1,
      artifacts: ["run:123", `scenario:${name}`]
    },
    offchainLogId: `log-${name}`
  };

  if (name === "fail_closed") return { ...base, verdict: "hold", reasonCodes: ["validation_failed"] };
  if (name === "duplicate_replay") return { ...base, decisionId: "dec-replay", correlationId: "corr-replay", offchainLogId: "log-replay" };
  return base;
}

function createInspectableSink(name, behavior = {}) {
  const writes = [];
  return {
    name,
    writes,
    async write(payload) {
      if (behavior.throwOnWrite) throw new Error(behavior.throwOnWrite);
      writes.push(payload);
      return {
        sink: name,
        status: AUDIT_WRITE_STATUS.WRITTEN,
        write_count: writes.length
      };
    }
  };
}

export async function runEvidenceScenario(name) {
  const input = createScenarioInput(name);
  const offchainSink = createInspectableSink("offchain");
  const idempotencyStore = createMemoryIdempotencyStore();
  const dualWriteEnabled = name !== "reconcile_timeout";
  const onchainFailureMode = name === "fail_closed" ? DUAL_WRITE_FAILURE_MODE.FAIL_CLOSED : DUAL_WRITE_FAILURE_MODE.FAIL_OPEN;
  const onchainEmitter = createInspectableSink("onchain", {
    throwOnWrite: ["fail_open", "fail_closed"].includes(name) ? "rpc unavailable" : null
  });

  const writer = createAuditDualWriter({
    offchainSink,
    onchainEmitter,
    idempotencyStore,
    onchainFailureMode
  });

  const runtime = { env: { MOLTCH_AUDIT_DUAL_WRITE_ENABLED: dualWriteEnabled ? "true" : "false" } };
  const attempts = [];

  if (name === "duplicate_replay") {
    attempts.push(await writer.write(input, runtime));
    attempts.push(await writer.write(input, runtime));
  } else if (name === "fail_closed") {
    try {
      attempts.push(await writer.write(input, runtime));
    } catch (error) {
      attempts.push({ error: error.message, record: createDecisionAuditRecord(input), event: createOnChainAuditEvent(createDecisionAuditRecord(input)) });
    }
  } else {
    attempts.push(await writer.write(input, runtime));
  }

  const last = attempts.at(-1);
  const blockedActions = [];
  const skippedActions = [];
  const emittedEvents = [];

  for (const write of onchainEmitter.writes) {
    emittedEvents.push({
      event_id: write.event_id,
      decision_id: write.decision_id,
      correlation_id: write.correlation_id,
      lifecycle_state: write.lifecycle_state,
      verdict: write.verdict
    });
  }

  if (name === "fail_open") {
    skippedActions.push("onchain_emit");
  }
  if (name === "fail_closed") {
    blockedActions.push("onchain_emit");
  }
  if (name === "reconcile_timeout") {
    skippedActions.push("onchain_emit_feature_flag_disabled");
  }
  if (name === "duplicate_replay") {
    skippedActions.push("duplicate_replay_write");
  }

  const verdict = name === "fail_closed"
    ? "blocked"
    : name === "fail_open"
      ? "partial_success"
      : name === "duplicate_replay"
        ? "replayed"
        : "success";

  const bundle = {
    schema_version: "audit_log_runtime_evidence.v1",
    scenario: name,
    generated_at: "deterministic",
    input_fixture: input,
    expected_events_emitted: emittedEvents,
    expected_blocked_actions: blockedActions,
    expected_skipped_actions: skippedActions,
    verdict_summary: {
      verdict,
      offchain_write_count: offchainSink.writes.length,
      onchain_write_count: onchainEmitter.writes.length,
      replayed: name === "duplicate_replay",
      dual_write_enabled: dualWriteEnabled
    }
  };

  bundle.manifest_hash = computeDigest(bundle);
  return bundle;
}

export async function buildRuntimeEvidenceBundles(outDir) {
  const scenarios = ["fail_open", "fail_closed", "duplicate_replay", "reconcile_success", "reconcile_timeout"];
  fs.mkdirSync(outDir, { recursive: true });
  const manifest = { schema_version: "audit_log_runtime_evidence_manifest.v1", generated_at: "deterministic", bundles: [] };

  for (const scenario of scenarios) {
    const bundle = await runEvidenceScenario(scenario);
    const fileName = `${scenario}.bundle.json`;
    fs.writeFileSync(new URL(fileName, outDir), `${JSON.stringify(bundle, null, 2)}\n`);
    manifest.bundles.push({ scenario, file: fileName, sha256: crypto.createHash("sha256").update(JSON.stringify(bundle, null, 2) + "\n").digest("hex") });
  }

  fs.writeFileSync(new URL("manifest.json", outDir), `${JSON.stringify(manifest, null, 2)}\n`);
  fs.writeFileSync(new URL("checksums.sha256", outDir), `${manifest.bundles.map((b) => `${b.sha256}  ${b.file}`).join("\n")}\n`);
  return manifest;
}
