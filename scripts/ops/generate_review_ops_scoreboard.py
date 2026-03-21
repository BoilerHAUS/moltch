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


def fail_field(file_path: Path, field_path: str, expected: str, observed):
    fail(
        f"file={file_path} field={field_path} expected={expected} observed={repr(observed)}"
    )


def validate_payload(payload: dict, source_file: Path):
    for k in REQUIRED_KEYS:
        if k not in payload:
            fail_field(source_file, f"$.{k}", "required key present", None)

    status = payload["status"]
    if status not in ("complete", "incomplete"):
        fail_field(source_file, "$.status", "'complete' or 'incomplete'", status)

    metrics = payload["metrics"]
    if not isinstance(metrics, dict):
        fail_field(source_file, "$.metrics", "object", type(metrics).__name__)

    for m in REQUIRED_METRICS:
        if m not in metrics:
            fail_field(source_file, f"$.metrics.{m}", "required metric present", None)

    for m_name, m in metrics.items():
        if not isinstance(m, dict):
            fail_field(source_file, f"$.metrics.{m_name}", "object", type(m).__name__)

        for field in ("label", "current", "prior", "trend", "slo_band"):
            if field not in m:
                fail_field(
                    source_file,
                    f"$.metrics.{m_name}.{field}",
                    "required field present",
                    None,
                )

        trend = m["trend"]
        if trend not in ("up", "down", "flat"):
            fail_field(
                source_file,
                f"$.metrics.{m_name}.trend",
                "'up' | 'down' | 'flat'",
                trend,
            )

    bottlenecks = payload["bottlenecks"]
    if not isinstance(bottlenecks, list) or len(bottlenecks) == 0:
        fail_field(source_file, "$.bottlenecks", "non-empty array", bottlenecks)


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
        fail_field(src, "$", "source file exists", "missing")

    payload = json.loads(src.read_text())
    validate_payload(payload, src)
    write_markdown(payload, out)
    print(f"[review-ops][pass] wrote {out}")


if __name__ == "__main__":
    main()
