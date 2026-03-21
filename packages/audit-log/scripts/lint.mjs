import fs from "node:fs";
import path from "node:path";

const root = new URL("../", import.meta.url);
const files = [
  "src/index.mjs",
  "src/runtimeEvidence.mjs",
  "test/dualWrite.test.mjs",
  "test/runtimeEvidence.test.mjs",
  "README.md",
  "fixtures/runtime-evidence-scenarios.json",
  "interfaces/policy-decision-audit-event.interface.json"
];

for (const file of files) {
  const abs = new URL(file, root);
  if (!fs.existsSync(abs)) {
    throw new Error(`missing required file: ${file}`);
  }

  const content = fs.readFileSync(abs, "utf8");
  if (!content.trim()) {
    throw new Error(`empty required file: ${file}`);
  }
}

console.log(`audit-log lint: ok (${files.length} files)`);
