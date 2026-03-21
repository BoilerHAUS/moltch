import fs from "node:fs";

const required = [
  "src/index.mjs",
  "src/stateMachine.mjs",
  "src/reasonCodeRegistry.mjs",
  "src/reasonCodeMigration.mjs",
  "src/decisionLoopSimulation.mjs",
  "scripts/check-reason-code-drift.mjs",
  "scripts/check-reason-code-migrations.mjs",
  "scripts/run-decision-loop-simulation.mjs",
  "fixtures/decision-loop-scenarios.v1.json",
  "artifacts/decision-loop-simulation.report.json",
  "artifacts/decision-loop-simulation.report.md",
  "data/reason-code-registry.v1.json",
  "data/reason-code-migration-map.v1.json",
  "test/stateMachine.test.mjs",
  "test/decisionLoopSimulation.test.mjs",
  "test/identityAttestation.test.mjs",
  "fixtures/identity-attestation/actor-attestation-schema.v1.json",
  "fixtures/identity-attestation/attestation-envelope-valid.json",
  "fixtures/identity-attestation/attestation-envelope-wrong-role.json",
  "fixtures/identity-attestation/attestation-envelope-expired.json",
  "fixtures/identity-attestation/attestation-envelope-revoked.json"
];

for (const rel of required) {
  if (!fs.existsSync(new URL(`../${rel}`, import.meta.url))) {
    console.error(`missing required file: ${rel}`);
    process.exit(1);
  }
}

console.log("policy-engine lint: ok");
