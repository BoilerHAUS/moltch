import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runEvidenceScenario, buildRuntimeEvidenceBundles } from "../src/runtimeEvidence.mjs";

test("runtime evidence scenarios produce deterministic verdict bundles", async () => {
  const failOpen = await runEvidenceScenario("fail_open");
  const failClosed = await runEvidenceScenario("fail_closed");
  const replay = await runEvidenceScenario("duplicate_replay");

  assert.equal(failOpen.verdict_summary.verdict, "partial_success");
  assert.deepEqual(failOpen.expected_skipped_actions, ["onchain_emit"]);
  assert.equal(failClosed.verdict_summary.verdict, "blocked");
  assert.deepEqual(failClosed.expected_blocked_actions, ["onchain_emit"]);
  assert.equal(replay.verdict_summary.replayed, true);
  assert.ok(replay.expected_skipped_actions.includes("duplicate_replay_write"));
});

test("runtime evidence manifest and bundles are emitted deterministically", async () => {
  const outDir = new URL(`file://${path.join(os.tmpdir(), 'moltch-audit-evidence-test')}/`);
  const manifest = await buildRuntimeEvidenceBundles(outDir);
  const manifestJson = JSON.parse(fs.readFileSync(new URL('manifest.json', outDir), 'utf8'));
  assert.equal(manifest.bundles.length, 5);
  assert.equal(manifestJson.bundles.length, 5);
  assert.ok(fs.existsSync(new URL('checksums.sha256', outDir)));
});
