import fs from "node:fs";
import { getTransitionTable } from "../src/stateMachine.mjs";

const out = new URL("../transition-table.generated.json", import.meta.url);
fs.writeFileSync(out, JSON.stringify(getTransitionTable(), null, 2) + "\n");
console.log("generated transition-table.generated.json");
