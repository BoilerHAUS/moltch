#!/usr/bin/env python3
import argparse
import json
import subprocess
from datetime import date
from pathlib import Path
from typing import Callable


def _run(cmd: list[str]) -> str:
    return subprocess.check_output(cmd, text=True).strip()


def _format_item(item: dict) -> str:
    due = item.get("next_review_due", "n/a")
    owner = item.get("owner_role", "unknown")
    return f"- [ ] `{item['path']}` (due: `{due}`, owner: `{owner}`)"


def _format_bucket(items: list[dict]) -> str:
    if not items:
        return "- [ ] none"
    return "\n".join(_format_item(item) for item in items)


def _render_owner_lanes(owner_lanes: dict) -> str:
    lines: list[str] = ["### lane grouping (owner_role)"]
    if not owner_lanes:
        return "\n".join(lines + ["- none", ""])

    for lane in sorted(owner_lanes.keys()):
        lane_buckets = owner_lanes.get(lane, {})
        overdue = lane_buckets.get("overdue", [])
        due_this_week = lane_buckets.get("due_this_week", [])
        missing = lane_buckets.get("missing_metadata", [])
        total = len(overdue) + len(due_this_week) + len(missing)
        lines.append(f"- **{lane}** (total actionable: {total})")
        if overdue:
            lines.append(f"  - overdue: {len(overdue)}")
        if due_this_week:
            lines.append(f"  - due_this_week: {len(due_this_week)}")
        if missing:
            lines.append(f"  - missing_metadata: {len(missing)}")
    lines.append("")
    return "\n".join(lines)


def render_issue_body(report: dict) -> str:
    return "\n".join([
        "## weekly doc review queue",
        f"- as_of: `{report['as_of']}`",
        f"- window_days: `{report['window_days']}`",
        "",
        _render_owner_lanes(report.get("owner_lanes", {})),
        f"### overdue ({len(report.get('overdue', []))})",
        _format_bucket(report.get("overdue", [])),
        "",
        f"### due_this_week ({len(report.get('due_this_week', []))})",
        _format_bucket(report.get("due_this_week", [])),
        "",
        f"### missing_metadata ({len(report.get('missing_metadata', []))})",
        _format_bucket(report.get("missing_metadata", [])),
        "",
        "Automation note: this issue is generated/updated by `scripts/ops/publish_doc_review_issue.py`.",
    ])


def upsert_weekly_issue(*, report: dict, repo: str, run_cmd: Callable[[list[str]], str] = _run) -> tuple[str, str]:
    as_of = date.fromisoformat(report["as_of"])
    week = as_of.isocalendar()
    title = f"ops: weekly doc review queue {week.year}-W{week.week:02d}"
    body = render_issue_body(report)

    search = run_cmd([
        "gh", "issue", "list",
        "--repo", repo,
        "--state", "open",
        "--search", f'in:title "{title}"',
        "--json", "number",
    ])
    items = json.loads(search)

    if items:
        number = str(items[0]["number"])
        run_cmd(["gh", "issue", "edit", number, "--repo", repo, "--title", title, "--body", body])
        return ("updated", number)

    run_cmd(["gh", "issue", "create", "--repo", repo, "--title", title, "--body", body])
    return ("created", "")


def main() -> None:
    parser = argparse.ArgumentParser(description="Create/update weekly doc review queue issue")
    parser.add_argument("--input", required=True, help="Path to doc review report JSON")
    parser.add_argument("--repo", default="BoilerHAUS/moltch")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    report = json.loads(Path(args.input).read_text(encoding="utf-8"))
    title = f"ops: weekly doc review queue {date.fromisoformat(report['as_of']).isocalendar().year}-W{date.fromisoformat(report['as_of']).isocalendar().week:02d}"

    if args.dry_run:
        print(title)
        print(render_issue_body(report))
        return

    action, number = upsert_weekly_issue(report=report, repo=args.repo)
    if action == "updated":
        print(f"updated issue #{number}")
    else:
        print("created weekly review issue")


if __name__ == "__main__":
    main()
