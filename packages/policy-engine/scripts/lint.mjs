import fs from "node:fs";

const required = [
  "src/index.mjs",
  "src/stateMachine.mjs",
  "test/stateMachine.test.mjs"
];

for (const rel of required) {
  if (!fs.existsSync(new URL(`../${rel}`, import.meta.url))) {
    console.error(`missing required file: ${rel}`);
    process.exit(1);
  }
}

console.log("policy-engine lint: ok");
