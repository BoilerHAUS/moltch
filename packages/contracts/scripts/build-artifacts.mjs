import fs from "node:fs";
import crypto from "node:crypto";

const root = new URL("../", import.meta.url);
const ifacePath = new URL("interfaces/policy-decision-seam.interface.json", root);
const artifactPath = new URL("artifacts/policy-decision-seam.artifact.json", root);
const checksumsPath = new URL("artifacts/checksums.sha256", root);

const iface = JSON.parse(fs.readFileSync(ifacePath, "utf8"));
const normalized = JSON.stringify(iface, Object.keys(iface).sort(), 2) + "\n";

const artifact = {
  generatedAt: "deterministic",
  interface: iface
};

const artifactJson = JSON.stringify(artifact, null, 2) + "\n";
fs.writeFileSync(artifactPath, artifactJson);

const hash = crypto.createHash("sha256").update(artifactJson).digest("hex");
fs.writeFileSync(checksumsPath, `${hash}  policy-decision-seam.artifact.json\n`);

console.log("artifacts built");
console.log(normalized ? "interface loaded" : "");
