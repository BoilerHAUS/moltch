import fs from "node:fs";

const required = [
  "src/index.mjs",
  "src/policyDecisionSeam.mjs",
  "src/reasonCodes.mjs",
  "interfaces/policy-decision-seam.interface.json",
  "interfaces/oracle-bridge-seam.interface.json",
  "src/oracleBridgeSeam.mjs",
  "test/invariants.test.mjs"
];

for (const rel of required) {
  if (!fs.existsSync(new URL(`../${rel}`, import.meta.url))) {
    console.error(`missing required file: ${rel}`);
    process.exit(1);
  }
}

console.log("contracts lint: ok");
