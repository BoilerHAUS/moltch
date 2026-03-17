import fs from "node:fs";
import { buildMigrationReport, loadReasonCodeMigrationMap, validateMigrationMapShape } from "../src/reasonCodeMigration.mjs";

const fixturePath = new URL("../../../docs/governance/fixtures/policy_reason_code_replay_compat_v1.json", import.meta.url);
const outPath = new URL("../../../docs/governance/evidence/policy_reason_code_migration_report_2026-03-17.json", import.meta.url);

const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
const map = loadReasonCodeMigrationMap();
validateMigrationMapShape(map);

const report = buildMigrationReport(fixture.events, { migrationMap: map });

for (const event of fixture.events) {
  const resolved = report.mappings[event.reason_code];
  if (resolved !== event.expected_resolved) {
    console.error(`[policy-engine][migration][fail] expected ${event.reason_code} -> ${event.expected_resolved}, got ${resolved}`);
    process.exit(1);
  }
}

fs.writeFileSync(outPath, JSON.stringify({
  fixture: "docs/governance/fixtures/policy_reason_code_replay_compat_v1.json",
  migration_map: "packages/policy-engine/data/reason-code-migration-map.v1.json",
  report
}, null, 2) + "\n");

console.log("[policy-engine][migration][pass] migration map + replay compatibility checks passed");
