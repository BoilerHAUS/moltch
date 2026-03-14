#!/usr/bin/env python3
import argparse
import json
from pathlib import Path

REQUIRED_KEYS = ["week", "status", "metrics", "bottlenecks", "action_ledger"]
REQUIRED_METRICS = [
    "pr_review_latency_hours",
    "blocker_over_48h_count",
    "handoff_latency_hours",
    "reopen_rate_pct",
]


def fail(msg: str):
    raise SystemExit(f"[review-ops][fail] {msg}")


def validate_payload(payload: dict):
    for k in REQUIRED_KEYS:
        if k not in payload:
            fail(f"missing key: {k}")

    if payload["status"] not in ("complete", "incomplete"):
        fail("status must be complete|incomplete")

    metrics = payload["metrics"]
    for m in REQUIRED_METRICS:
        if m not in metrics:
            fail(f"missing metric: {m}")

    for m_name, m in metrics.items():
        for field in ("label", "current", "prior", "trend", "slo_band"):
            if field not in m:
                fail(f"metric {m_name} missing field: {field}")
        if m["trend"] not in ("up", "down", "flat"):
            fail(f"metric {m_name} trend must be up|down|flat")

    if len(payload["bottlenecks"]) == 0:
        fail("bottlenecks must not be empty")


def write_markdown(payload: dict, out_path: Path):
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w") as f:
        f.write(f"# review-operations scoreboard — {payload['week']}\n\n")
        f.write(f"- status: **{payload['status']}**\n")
        if payload.get("missing_sources"):
            f.write("- missing_sources:\n")
            for src in payload["missing_sources"]:
                f.write(f"  - {src}\n")
        f.write("\n## metric snapshot\n")
        f.write("| metric | current | prior | trend | SLO band |\n")
        f.write("|---|---:|---:|---|---|\n")
        for m in payload["metrics"].values():
            f.write(f"| {m['label']} | {m['current']} | {m['prior']} | {m['trend']} | {m['slo_band']} |\n")

        f.write("\n## top 3 bottlenecks\n")
        for i, b in enumerate(payload["bottlenecks"][:3], 1):
            f.write(f"{i}. **{b['name']}** — owner: `{b['owner']}` — due: `{b['due_date']}`\n")
            f.write(f"   - corrective_action: {b['corrective_action']}\n")

        f.write("\n## action ledger\n")
        f.write("| action | owner | due_date | last_week_status | this_week_status |\n")
        f.write("|---|---|---|---|---|\n")
        for a in payload["action_ledger"]:
            f.write(
                f"| {a['action']} | {a['owner']} | {a['due_date']} | {a['last_week_status']} | {a['this_week_status']} |\n"
            )


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--source-json", required=True)
    p.add_argument("--out", required=True)
    args = p.parse_args()

    src = Path(args.source_json)
    out = Path(args.out)

    if not src.exists():
        fail(f"source json not found: {src}")

    payload = json.loads(src.read_text())
    validate_payload(payload)
    write_markdown(payload, out)
    print(f"[review-ops][pass] wrote {out}")


if __name__ == "__main__":
    main()
