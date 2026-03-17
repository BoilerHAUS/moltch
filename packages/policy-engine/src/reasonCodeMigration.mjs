import fs from "node:fs";
import { REASON_CODE_ERROR, assertReasonCodeAllowed, buildReasonCodeIndex, loadReasonCodeRegistry } from "./reasonCodeRegistry.mjs";

export const REASON_CODE_MIGRATION_ERROR = Object.freeze({
  MAP_INVALID: "ERR_REASON_CODE_MIGRATION_MAP_INVALID",
  MAP_AMBIGUOUS: "ERR_REASON_CODE_MIGRATION_MAP_AMBIGUOUS",
  DEPRECATION_CUTOFF_EXCEEDED: "ERR_REASON_CODE_DEPRECATION_CUTOFF_EXCEEDED"
});

function fail(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

export function loadReasonCodeMigrationMap(pathOrUrl = new URL("../data/reason-code-migration-map.v1.json", import.meta.url)) {
  const parsed = JSON.parse(fs.readFileSync(pathOrUrl, "utf8"));
  validateMigrationMapShape(parsed);
  return parsed;
}

export function validateMigrationMapShape(map) {
  if (!map || typeof map !== "object") throw fail(REASON_CODE_MIGRATION_ERROR.MAP_INVALID, "map must be object");
  if (!Array.isArray(map.mappings)) throw fail(REASON_CODE_MIGRATION_ERROR.MAP_INVALID, "map.mappings must be array");

  const seen = new Set();
  for (const m of map.mappings) {
    if (!m?.from || !m?.to) throw fail(REASON_CODE_MIGRATION_ERROR.MAP_INVALID, "mapping requires from/to");
    if (seen.has(m.from)) throw fail(REASON_CODE_MIGRATION_ERROR.MAP_AMBIGUOUS, `duplicate mapping for ${m.from}`);
    seen.add(m.from);
  }
  return true;
}

export function resolveReasonCodeLifecycle(reasonCode, options = {}) {
  const registryIndex = options.registryIndex ?? buildReasonCodeIndex(loadReasonCodeRegistry());
  const migrationMap = options.migrationMap ?? loadReasonCodeMigrationMap();
  const effectiveAt = options.effectiveAt ?? "2026-03-17T00:00:00Z";

  const mapping = migrationMap.mappings.find((m) => m.from === reasonCode);
  const resolved = mapping ? mapping.to : reasonCode;

  const entry = registryIndex.get(resolved);
  if (!entry) throw fail(REASON_CODE_ERROR.CODE_UNKNOWN, `unknown reason code: ${resolved}`);

  if (entry.status === "removed") {
    throw fail(REASON_CODE_ERROR.CODE_REMOVED, `removed reason code: ${resolved}`);
  }

  if (entry.status === "deprecated") {
    const cutoff = entry.deprecated_after_utc;
    if (cutoff && effectiveAt > cutoff) {
      throw fail(REASON_CODE_MIGRATION_ERROR.DEPRECATION_CUTOFF_EXCEEDED, `deprecated cutoff exceeded: ${resolved}`);
    }
    return {
      original: reasonCode,
      resolved,
      policy_status: "deprecated_within_window",
      mapping_applied: Boolean(mapping)
    };
  }

  assertReasonCodeAllowed(resolved, registryIndex, { allowDeprecated: true });
  return {
    original: reasonCode,
    resolved,
    policy_status: "active",
    mapping_applied: Boolean(mapping)
  };
}

export function buildMigrationReport(records, options = {}) {
  const results = records.map((r) => resolveReasonCodeLifecycle(r.reason_code, options));
  const byMapping = Object.fromEntries(results.map((r) => [r.original, r.resolved]));
  return {
    total_records: results.length,
    migrated_records: results.filter((r) => r.mapping_applied).length,
    policy_status_counts: results.reduce((acc, r) => {
      acc[r.policy_status] = (acc[r.policy_status] ?? 0) + 1;
      return acc;
    }, {}),
    mappings: byMapping,
    results
  };
}
