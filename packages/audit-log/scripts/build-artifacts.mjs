import fs from "node:fs";
import crypto from "node:crypto";

const root = new URL("../", import.meta.url);
const ifacePath = new URL("interfaces/policy-decision-audit-event.interface.json", root);
const artifactPath = new URL("artifacts/policy-decision-audit-event.artifact.json", root);
const checksumPath = new URL("artifacts/checksums.sha256", root);

const iface = JSON.parse(fs.readFileSync(ifacePath, "utf8"));
const artifact = {
  generatedAt: "deterministic",
  interface: iface
};
const json = JSON.stringify(artifact, null, 2) + "\n";

fs.mkdirSync(new URL("artifacts/", root), { recursive: true });
fs.writeFileSync(artifactPath, json);
fs.writeFileSync(checksumPath, `${crypto.createHash("sha256").update(json).digest("hex")}  policy-decision-audit-event.artifact.json\n`);

console.log("audit-log artifacts built");
