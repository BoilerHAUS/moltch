#!/usr/bin/env python3
import argparse
import json
import re
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

REQUIRED_KEYS = {"owner_role", "review_cadence", "next_review_due"}
META_LINE = re.compile(r"^-\s*([a-zA-Z0-9_]+):\s*(.+?)\s*$")


@dataclass
class DocReviewRecord:
    path: str
    owner_role: str | None
    review_cadence: str | None
    next_review_due: str | None
    classification: str
    reason: str | None = None


def parse_metadata(md_text: str) -> dict[str, str]:
    lines = md_text.splitlines()
    in_meta = False
    out: dict[str, str] = {}
    for line in lines:
        if line.strip().lower() == "## metadata":
            in_meta = True
            continue
        if in_meta:
            if line.startswith("## "):
                break
            m = META_LINE.match(line.strip())
            if m:
                out[m.group(1).strip()] = m.group(2).strip()
    return out


def classify_doc(path: Path, as_of: date, horizon_days: int) -> DocReviewRecord:
    try:
        text = path.read_text(encoding="utf-8")
    except Exception as exc:
        return DocReviewRecord(str(path), None, None, None, "missing_metadata", f"read_error: {exc}")

    md = parse_metadata(text)
    missing = [k for k in REQUIRED_KEYS if not md.get(k)]
    owner = md.get("owner_role")
    cadence = md.get("review_cadence")
    due_raw = md.get("next_review_due")

    if missing:
        return DocReviewRecord(str(path), owner, cadence, due_raw, "missing_metadata", f"missing keys: {', '.join(missing)}")

    try:
        due = date.fromisoformat(str(due_raw))
    except ValueError:
        return DocReviewRecord(str(path), owner, cadence, due_raw, "missing_metadata", "invalid next_review_due")

    if due < as_of:
        return DocReviewRecord(str(path), owner, cadence, due.isoformat(), "overdue")

    if due <= as_of + timedelta(days=horizon_days):
        return DocReviewRecord(str(path), owner, cadence, due.isoformat(), "due_this_week")

    return DocReviewRecord(str(path), owner, cadence, due.isoformat(), "scheduled")


def build_report(root: Path, as_of: date, horizon_days: int) -> dict:
    docs = sorted(p for p in root.rglob("*.md") if p.name != "README.md")
    records = [classify_doc(p, as_of, horizon_days) for p in docs]

    by_class = defaultdict(list)
    by_owner = defaultdict(lambda: defaultdict(list))

    for r in records:
        item = {
            "path": r.path,
            "owner_role": r.owner_role,
            "review_cadence": r.review_cadence,
            "next_review_due": r.next_review_due,
        }
        if r.reason:
            item["reason"] = r.reason
        by_class[r.classification].append(item)
        by_owner[r.owner_role or "unknown"][r.classification].append(item)

    return {
        "artifact_version": "doc_review_due_report.v1",
        "generated_at_utc": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "as_of": as_of.isoformat(),
        "window_days": horizon_days,
        "metrics": {
            "docs_scanned": len(records),
            "overdue_count": len(by_class["overdue"]),
            "due_this_week_count": len(by_class["due_this_week"]),
            "missing_metadata_count": len(by_class["missing_metadata"]),
            "scheduled_count": len(by_class["scheduled"]),
        },
        "overdue": by_class["overdue"],
        "due_this_week": by_class["due_this_week"],
        "missing_metadata": by_class["missing_metadata"],
        "scheduled": by_class["scheduled"],
        "owner_lanes": by_owner,
    }


def render_markdown(report: dict) -> str:
    def section(name: str, items: list[dict]) -> str:
        lines = [f"## {name} ({len(items)})"]
        if not items:
            return "\n".join(lines + ["- none", ""])
        for item in items:
            line = f"- `{item['path']}`"
            if item.get("next_review_due"):
                line += f" — due `{item['next_review_due']}`"
            if item.get("owner_role"):
                line += f" — owner `{item['owner_role']}`"
            if item.get("reason"):
                line += f" — {item['reason']}"
            lines.append(line)
        lines.append("")
        return "\n".join(lines)

    header = [
        "# doc review due report",
        f"- as_of: `{report['as_of']}`",
        f"- window_days: `{report['window_days']}`",
        f"- docs_scanned: `{report['metrics']['docs_scanned']}`",
        "",
    ]

    parts = [
        section("overdue", report.get("overdue", [])),
        section("due_this_week", report.get("due_this_week", [])),
        section("missing_metadata", report.get("missing_metadata", [])),
    ]
    return "\n".join(header + parts)


def main() -> None:
    parser = argparse.ArgumentParser(description="Scan docs metadata and build review-due report")
    parser.add_argument("--root", default="docs", help="Root docs directory to scan")
    parser.add_argument("--as-of", default=None, help="Date override (YYYY-MM-DD)")
    parser.add_argument("--window-days", type=int, default=7)
    parser.add_argument("--output-json", default=None)
    parser.add_argument("--output-md", default=None)
    args = parser.parse_args()

    as_of = date.fromisoformat(args.as_of) if args.as_of else datetime.now(timezone.utc).date()
    report = build_report(Path(args.root), as_of, args.window_days)

    if args.output_json:
        Path(args.output_json).parent.mkdir(parents=True, exist_ok=True)
        Path(args.output_json).write_text(json.dumps(report, indent=2), encoding="utf-8")
    else:
        print(json.dumps(report, indent=2))

    if args.output_md:
        Path(args.output_md).parent.mkdir(parents=True, exist_ok=True)
        Path(args.output_md).write_text(render_markdown(report), encoding="utf-8")


if __name__ == "__main__":
    main()
