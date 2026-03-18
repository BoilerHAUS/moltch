import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildSimulationReport,
  loadScenarioSuite,
  renderSimulationMarkdown
} from "../src/decisionLoopSimulation.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");

function parseArgs(argv) {
  const args = {
    fixture: path.join(root, "fixtures", "decision-loop-scenarios.v1.json"),
    outJson: path.join(root, "artifacts", "decision-loop-simulation.report.json"),
    outMd: path.join(root, "artifacts", "decision-loop-simulation.report.md"),
    write: false,
    seed: undefined,
    generatedAtUtc: undefined
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--fixture") args.fixture = path.resolve(argv[++i]);
    else if (arg === "--out-json") args.outJson = path.resolve(argv[++i]);
    else if (arg === "--out-md") args.outMd = path.resolve(argv[++i]);
    else if (arg === "--seed") args.seed = argv[++i];
    else if (arg === "--generated-at-utc") args.generatedAtUtc = argv[++i];
    else if (arg === "--write") args.write = true;
  }

  return args;
}

const args = parseArgs(process.argv.slice(2));
const suite = loadScenarioSuite(args.fixture);
const report = buildSimulationReport(suite, {
  seed: args.seed,
  generatedAtUtc: args.generatedAtUtc
});
const nextJson = JSON.stringify(report, null, 2) + "\n";
const nextMd = renderSimulationMarkdown(report);

if (args.write) {
  fs.mkdirSync(path.dirname(args.outJson), { recursive: true });
  fs.mkdirSync(path.dirname(args.outMd), { recursive: true });
  fs.writeFileSync(args.outJson, nextJson);
  fs.writeFileSync(args.outMd, nextMd);
  console.log(`[decision-loop-sim][pass] wrote ${path.relative(process.cwd(), args.outJson)}`);
  console.log(`[decision-loop-sim][pass] wrote ${path.relative(process.cwd(), args.outMd)}`);
  process.exit(0);
}

const currentJson = fs.readFileSync(args.outJson, "utf8");
const currentMd = fs.readFileSync(args.outMd, "utf8");

if (currentJson !== nextJson || currentMd !== nextMd) {
  console.error("[decision-loop-sim][fail] checked-in simulation report is out of date");
  console.error("Run: node scripts/run-decision-loop-simulation.mjs --write");
  process.exit(1);
}

console.log("[decision-loop-sim][pass] checked-in simulation report matches deterministic fixture output");
