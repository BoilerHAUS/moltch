#!/usr/bin/env python3
import argparse
import csv
import json
import os
import sys
from datetime import datetime, timezone


def iso_now():
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def read_rows(csv_path: str):
    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"required data source missing: {csv_path}")

    rows = []
    with open(csv_path, newline="") as f:
        reader = csv.DictReader(f)
        required_cols = {"index", "timestamp_utc", "ok", "status_code", "error"}
        missing = required_cols - set(reader.fieldnames or [])
        if missing:
            raise ValueError(f"required columns missing in source csv: {sorted(missing)}")

        for row in reader:
            ok_raw = str(row.get("ok", "")).strip().lower()
            ok = ok_raw in ("true", "1", "yes", "y")
            rows.append(
                {
                    "index": int(row.get("index", 0)),
                    "timestamp_utc": row.get("timestamp_utc"),
                    "ok": ok,
                    "status_code": row.get("status_code"),
                    "error": row.get("error"),
                }
            )

    if not rows:
        raise ValueError("required data source is empty: no probe rows found")
    return rows


def summarize(rows, threshold_pct: float, window_hours: int):
    total = len(rows)
    success_count = sum(1 for r in rows if r["ok"])
    failure_count = total - success_count
    success_pct = round((success_count / total) * 100, 3)

    status_error_counts = {}
    for r in rows:
        if r["ok"]:
            continue
        key = f"{r.get('status_code') or 'none'}|{r.get('error') or 'none'}"
        status_error_counts[key] = status_error_counts.get(key, 0) + 1

    failure_slices = [
        {
            "status_code": k.split("|", 1)[0],
            "error": k.split("|", 1)[1],
            "count": v,
        }
        for k, v in sorted(status_error_counts.items(), key=lambda kv: kv[1], reverse=True)
    ]

    metric_eval = {
        "metric": "readiness_success_pct",
        "window_hours": window_hours,
        "threshold_pct": threshold_pct,
        "observed_pct": success_pct,
        "verdict": "pass" if success_pct >= threshold_pct else "fail",
    }

    overall_verdict = metric_eval["verdict"]

    return {
        "generated_at_utc": iso_now(),
        "window_hours": window_hours,
        "probe_count": total,
        "success_count": success_count,
        "failure_count": failure_count,
        "metrics": [metric_eval],
        "failure_slices": failure_slices,
        "overall_verdict": overall_verdict,
    }


def write_json(path: str, payload: dict):
    with open(path, "w") as f:
        json.dump(payload, f, indent=2)
        f.write("\n")


def write_markdown(path: str, payload: dict, source_csv: str):
    metric = payload["metrics"][0]
    with open(path, "w") as f:
        f.write("# readiness evidence summary\n\n")
        f.write(f"- generated_at_utc: {payload['generated_at_utc']}\n")
        f.write(f"- source_csv: {source_csv}\n")
        f.write(f"- window_hours: {payload['window_hours']}\n")
        f.write(f"- probe_count: {payload['probe_count']}\n")
        f.write(f"- success_count: {payload['success_count']}\n")
        f.write(f"- failure_count: {payload['failure_count']}\n")
        f.write(f"- overall_verdict: **{payload['overall_verdict']}**\n\n")

        f.write("## threshold evaluation\n")
        f.write(
            f"- readiness_success_pct: observed `{metric['observed_pct']}%` vs threshold `{metric['threshold_pct']}%` -> **{metric['verdict']}**\n\n"
        )

        f.write("## failure slices\n")
        if not payload["failure_slices"]:
            f.write("- none\n")
        else:
            for item in payload["failure_slices"]:
                f.write(
                    f"- status_code={item['status_code']} error={item['error']} count={item['count']}\n"
                )


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--source-csv", required=True)
    p.add_argument("--out-dir", required=True)
    p.add_argument("--window-hours", type=int, default=24)
    p.add_argument("--threshold-pct", type=float, default=99.0)
    args = p.parse_args()

    try:
        rows = read_rows(args.source_csv)
        payload = summarize(rows, args.threshold_pct, args.window_hours)
    except Exception as e:
        print(f"[readiness-writer][fail] {e}", file=sys.stderr)
        sys.exit(1)

    os.makedirs(args.out_dir, exist_ok=True)
    json_path = os.path.join(args.out_dir, "readiness_evidence_summary.json")
    md_path = os.path.join(args.out_dir, "readiness_evidence_summary.md")

    write_json(json_path, payload)
    write_markdown(md_path, payload, args.source_csv)

    print(f"[readiness-writer][pass] wrote {json_path}")
    print(f"[readiness-writer][pass] wrote {md_path}")

    if payload["overall_verdict"] != "pass":
        print("[readiness-writer][fail] threshold not met (fail-closed)", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
