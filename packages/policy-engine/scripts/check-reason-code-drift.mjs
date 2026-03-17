import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadReasonCodeRegistry } from "../src/reasonCodeRegistry.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const CATALOG = path.join(ROOT, "docs/governance/POLICY_DECISION_REASON_CODE_CATALOG_V1_2.md");

function parseCatalogCodes(markdown) {
  return new Set(
    markdown
      .split("\n")
      .filter((line) => line.startsWith("|") && !line.includes("---"))
      .map((line) => line.split("|")[1]?.trim())
      .filter((code) => code && code !== "reason_code")
  );
}

const registry = loadReasonCodeRegistry();
const registryCodes = new Set(registry.codes.map((entry) => entry.code));
const catalogCodes = parseCatalogCodes(fs.readFileSync(CATALOG, "utf8"));

const missingInRegistry = [...catalogCodes].filter((code) => !registryCodes.has(code));
const missingInCatalog = [...registryCodes].filter((code) => !catalogCodes.has(code));

if (missingInRegistry.length || missingInCatalog.length) {
  console.error("[policy-engine][drift][fail] reason-code catalog drift detected");
  if (missingInRegistry.length) {
    console.error(`  missing in registry: ${missingInRegistry.join(", ")}`);
  }
  if (missingInCatalog.length) {
    console.error(`  missing in governance catalog: ${missingInCatalog.join(", ")}`);
  }
  process.exit(1);
}

console.log("[policy-engine][drift][pass] reason-code registry matches governance catalog");
