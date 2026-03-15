#!/usr/bin/env python3
import argparse
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List


def fail(msg: str) -> None:
    print(f"[roadmap-rows][fail] {msg}", file=sys.stderr)
    sys.exit(1)


def run_gh_json(args: List[str]) -> Any:
    try:
        out = subprocess.check_output(["gh", *args], text=True)
    except FileNotFoundError:
        fail("gh CLI not found in PATH")
    except subprocess.CalledProcessError as e:
        fail(f"gh command failed ({e.returncode}): {' '.join(args)}")

    try:
        return json.loads(out)
    except json.JSONDecodeError as e:
        fail(f"unable to parse gh JSON output: {e}")


def utc_date() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def load_hints(path: str | None) -> Dict[str, Dict[str, str]]:
    if not path:
        return {}
    p = Path(path)
    if not p.exists():
        fail(f"hints file not found: {path}")

    try:
        payload = json.loads(p.read_text(encoding="utf-8"))
    except Exception as e:
        fail(f"failed to parse hints file {path}: {e}")

    if not isinstance(payload, dict):
        fail("hints file must be a JSON object keyed by issue number")

    hints: Dict[str, Dict[str, str]] = {}
    for key, value in payload.items():
        if not isinstance(value, dict):
            fail(f"hints entry for {key} must be an object")
        hints[str(key)] = {str(k): str(v) for k, v in value.items()}
    return hints


def render_row(number: int, hints: Dict[str, str], defaults: Dict[str, str]) -> str:
    lane = hints.get("lane", defaults["lane"])
    status = hints.get("status", defaults["status"])
    owner = hints.get("owner", defaults["owner"])
    dependency = hints.get("dependency", defaults["dependency"])
    target_window = hints.get("target_window", defaults["target_window"])
    last_updated = hints.get("last_updated", defaults["last_updated"])
    unblock_ask = hints.get("unblock_ask", defaults["unblock_ask"])

    return f"| #{number} | {lane} | {status} | {owner} | {dependency} | {target_window} | {last_updated} | {unblock_ask} |"


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate markdown rows for ROADMAP_V1 open issues mapping table."
    )
    parser.add_argument("--repo", default="BoilerHAUS/moltch", help="GitHub repo slug owner/repo")
    parser.add_argument("--hints", help="Optional JSON hints file keyed by issue number")
    parser.add_argument("--output", help="Optional output file path; defaults to stdout")
    parser.add_argument("--include-header", action="store_true", help="Include markdown table header")
    parser.add_argument("--lane-default", default="program mgmt")
    parser.add_argument("--status-default", default="planned")
    parser.add_argument("--owner-default", default="shared")
    parser.add_argument("--dependency-default", default="none")
    parser.add_argument("--target-window-default", default="v1")
    parser.add_argument("--unblock-ask-default", default="n/a")
    parser.add_argument("--last-updated-default", default=utc_date())
    args = parser.parse_args()

    hints = load_hints(args.hints)

    issues = run_gh_json([
        "api",
        "--paginate",
        "-X",
        "GET",
        f"repos/{args.repo}/issues?state=open&per_page=100",
    ])

    if not isinstance(issues, list):
        fail("unexpected GitHub API payload for issues list")

    open_issues = [i for i in issues if isinstance(i, dict) and "pull_request" not in i]
    open_issues.sort(key=lambda i: i.get("number", 0))

    defaults = {
        "lane": args.lane_default,
        "status": args.status_default,
        "owner": args.owner_default,
        "dependency": args.dependency_default,
        "target_window": args.target_window_default,
        "last_updated": args.last_updated_default,
        "unblock_ask": args.unblock_ask_default,
    }

    lines: List[str] = []
    if args.include_header:
        lines.append("| issue | lane/phase | status | owner | dependency | target_window | last_updated | unblock_ask |")
        lines.append("|---|---|---|---|---|---|---|---|")

    for issue in open_issues:
        num = issue.get("number")
        if not isinstance(num, int):
            continue
        row = render_row(num, hints.get(str(num), {}), defaults)
        lines.append(row)

    output = "\n".join(lines)
    if args.output:
        Path(args.output).write_text(output + "\n", encoding="utf-8")
        print(f"[roadmap-rows][pass] wrote {len(lines)} rows to {args.output}")
    else:
        print(output)


if __name__ == "__main__":
    main()
