#!/usr/bin/env python3
import argparse
import json
import subprocess
from datetime import date
from pathlib import Path


def _run(cmd: list[str]) -> str:
    return subprocess.check_output(cmd, text=True).strip()


def render_issue_body(report: dict) -> str:
    def checklist(items: list[dict]) -> str:
        if not items:
            return "- [ ] none"
        rows = []
        for item in items:
            due = item.get("next_review_due", "n/a")
            owner = item.get("owner_role", "unknown")
            rows.append(f"- [ ] `{item['path']}` (due: `{due}`, owner: `{owner}`)")
        return "\n".join(rows)

    return "\n".join([
        "## weekly doc review queue",
        f"- as_of: `{report['as_of']}`",
        f"- window_days: `{report['window_days']}`",
        "",
        f"### overdue ({len(report.get('overdue', []))})",
        checklist(report.get("overdue", [])),
        "",
        f"### due_this_week ({len(report.get('due_this_week', []))})",
        checklist(report.get("due_this_week", [])),
        "",
        f"### missing_metadata ({len(report.get('missing_metadata', []))})",
        checklist(report.get("missing_metadata", [])),
        "",
        "Automation note: this issue is generated/updated by `scripts/ops/publish_doc_review_issue.py`.",
    ])


def main() -> None:
    parser = argparse.ArgumentParser(description="Create/update weekly doc review queue issue")
    parser.add_argument("--input", required=True, help="Path to doc review report JSON")
    parser.add_argument("--repo", default="BoilerHAUS/moltch")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    report = json.loads(Path(args.input).read_text(encoding="utf-8"))
    as_of = date.fromisoformat(report["as_of"])
    week = as_of.isocalendar()
    title = f"ops: weekly doc review queue {week.year}-W{week.week:02d}"
    body = render_issue_body(report)

    if args.dry_run:
        print(title)
        print(body)
        return

    search = _run([
        "gh", "issue", "list",
        "--repo", args.repo,
        "--state", "open",
        "--search", f'in:title "{title}"',
        "--json", "number",
    ])
    items = json.loads(search)

    if items:
        number = str(items[0]["number"])
        _run(["gh", "issue", "edit", number, "--repo", args.repo, "--title", title, "--body", body])
        print(f"updated issue #{number}")
    else:
        _run(["gh", "issue", "create", "--repo", args.repo, "--title", title, "--body", body])
        print("created weekly review issue")


if __name__ == "__main__":
    main()
