import fs from "node:fs";
import crypto from "node:crypto";

const root = new URL("../", import.meta.url);
const interfaceSpecs = [
  {
    input: new URL("interfaces/policy-decision-seam.interface.json", root),
    output: new URL("artifacts/policy-decision-seam.artifact.json", root),
    name: "policy-decision-seam.artifact.json"
  },
  {
    input: new URL("interfaces/oracle-bridge-seam.interface.json", root),
    output: new URL("artifacts/oracle-bridge-seam.artifact.json", root),
    name: "oracle-bridge-seam.artifact.json"
  }
];
const checksumsPath = new URL("artifacts/checksums.sha256", root);

const checksums = [];
for (const spec of interfaceSpecs) {
  const iface = JSON.parse(fs.readFileSync(spec.input, "utf8"));
  const artifact = {
    generatedAt: "deterministic",
    interface: iface
  };
  const artifactJson = JSON.stringify(artifact, null, 2) + "\n";
  fs.writeFileSync(spec.output, artifactJson);
  const hash = crypto.createHash("sha256").update(artifactJson).digest("hex");
  checksums.push(`${hash}  ${spec.name}`);
}

fs.writeFileSync(checksumsPath, `${checksums.join("\n")}\n`);

console.log("artifacts built");
