#!/usr/bin/env python3
import argparse
import json
import re
import subprocess
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

SCHEMA_VERSION = "roadmap_open_issue_reconciliation.v1"
ROADMAP_SECTION_HEADING = "## open issues mapping (canonical)"
EXCLUDED_SECTION_HEADING = "## excluded issues"
ROADMAP_PATH_DEFAULT = "docs/product/ROADMAP_V1.md"
SAFE_REPO_FILE = ROADMAP_PATH_DEFAULT
NO_TOUCH_ZONES = [
    "docs/product/ROADMAP_V1.md metadata block",
    "docs/product/ROADMAP_V1.md objective/phase/boundary sections",
    "roadmap row semantic fields: lane/phase, status, owner, dependency, target_window, unblock_ask",
    "excluded-issue rationales",
    "issue bodies, issue comments, labels, and project board state",
    "policy/governance docs outside roadmap mapping evidence"
]

DRIFT_RULES = {
    "missing_open_issue_tracking": {
        "pre-merge": {
            "action": "block_merge",
            "summary": "same_pr_tracking_update_required",
            "blocker": "Open issue is neither mapped nor excluded; update the roadmap table or add an exclusion rationale before merge.",
            "follow_up": None,
        },
        "post-merge": {
            "action": "post_merge_follow_up",
            "summary": "tracking_follow_up_required",
            "blocker": None,
            "follow_up": "Record roadmap mapping or explicit exclusion rationale within 24h of merge.",
        },
    },
    "duplicate_mapping_rows": {
        "pre-merge": {
            "action": "block_merge",
            "summary": "repair_duplicate_mapping_before_merge",
            "blocker": "Open issue appears more than once in the canonical roadmap table.",
            "follow_up": None,
        },
        "post-merge": {
            "action": "post_merge_follow_up",
            "summary": "repair_duplicate_mapping_after_merge",
            "blocker": None,
            "follow_up": "Collapse duplicate roadmap rows for the same open issue within 24h of merge.",
        },
    },
    "duplicate_exclusion_entries": {
        "pre-merge": {
            "action": "block_merge",
            "summary": "repair_duplicate_exclusion_before_merge",
            "blocker": "Open issue appears more than once in the excluded issues list.",
            "follow_up": None,
        },
        "post-merge": {
            "action": "post_merge_follow_up",
            "summary": "repair_duplicate_exclusion_after_merge",
            "blocker": None,
            "follow_up": "Collapse duplicate exclusion entries within 24h of merge.",
        },
    },
    "overlap_mapped_and_excluded": {
        "pre-merge": {
            "action": "block_merge",
            "summary": "resolve_conflicting_tracking_before_merge",
            "blocker": "Open issue is tracked in both canonical locations; pick one source of truth before merge.",
            "follow_up": None,
        },
        "post-merge": {
            "action": "post_merge_follow_up",
            "summary": "resolve_conflicting_tracking_after_merge",
            "blocker": None,
            "follow_up": "Remove either the roadmap row or the exclusion entry within 24h of merge.",
        },
    },
    "stale_mapping_closed_issue": {
        "pre-merge": {
            "action": "block_merge",
            "summary": "remove_stale_mapping_before_merge",
            "blocker": "Closed issue still appears in the open-issue roadmap table.",
            "follow_up": None,
        },
        "post-merge": {
            "action": "post_merge_follow_up",
            "summary": "remove_stale_mapping_after_merge",
            "blocker": None,
            "follow_up": "Remove stale closed-issue rows from the roadmap table within 24h of merge.",
        },
    },
    "stale_exclusion_closed_issue": {
        "pre-merge": {
            "action": "block_merge",
            "summary": "remove_stale_exclusion_before_merge",
            "blocker": "Closed issue still appears in the excluded issues list.",
            "follow_up": None,
        },
        "post-merge": {
            "action": "post_merge_follow_up",
            "summary": "remove_stale_exclusion_after_merge",
            "blocker": None,
            "follow_up": "Remove stale closed-issue exclusions within 24h of merge.",
        },
    },
}


def fail(message: str) -> None:
    print(f"[roadmap-reconcile][fail] {message}", file=sys.stderr)
    raise SystemExit(1)


def utc_timestamp() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def parse_generated_at(value: str | None) -> str:
    if value is None:
        return utc_timestamp()
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    except ValueError as exc:
        fail(f"invalid --generated-at-utc value: {exc}")


def sanitize_stamp(timestamp: str) -> str:
    return timestamp.replace(":", "").replace("-", "").replace("T", "T").replace("Z", "Z")


def run_gh_json(repo: str) -> Any:
    args = [
        "gh",
        "api",
        "--paginate",
        "--jq",
        ".[]",
        "-X",
        "GET",
        f"repos/{repo}/issues?state=open&per_page=100",
    ]
    try:
        output = subprocess.check_output(args, text=True)
    except FileNotFoundError:
        fail("gh CLI not found in PATH")
    except subprocess.CalledProcessError as exc:
        fail(f"gh command failed ({exc.returncode}): {' '.join(args[1:])}")

    decoded_items: list[Any] = []
    for line in output.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        try:
            decoded_items.append(json.loads(stripped))
        except json.JSONDecodeError as exc:
            fail(f"unable to parse paginated gh JSON line: {exc}")
    return decoded_items


def load_issue_payload(path: str | None, repo: str) -> list[dict[str, Any]]:
    if path:
        payload = json.loads(Path(path).read_text(encoding="utf-8"))
    else:
        payload = run_gh_json(repo)

    if isinstance(payload, dict) and isinstance(payload.get("issues"), list):
        payload = payload["issues"]
    if not isinstance(payload, list):
        fail("issue payload must be a JSON array or an object with an 'issues' array")

    open_issues: list[dict[str, Any]] = []
    for item in payload:
        if not isinstance(item, dict):
            continue
        if "pull_request" in item:
            continue
        number = item.get("number")
        if not isinstance(number, int):
            continue
        open_issues.append(
            {
                "number": number,
                "title": str(item.get("title", "")),
                "url": str(item.get("html_url") or item.get("url") or ""),
            }
        )
    open_issues.sort(key=lambda issue: issue["number"])
    return open_issues


def extract_section(lines: list[str], heading: str) -> tuple[int, list[str]]:
    start = -1
    for index, line in enumerate(lines):
        if line.strip().startswith(heading):
            start = index + 1
            break
    if start == -1:
        fail(f"missing roadmap section: {heading}")

    section: list[str] = []
    for line in lines[start:]:
        if line.startswith("## "):
            break
        section.append(line.rstrip("\n"))
    return start + 1, section


def parse_roadmap(roadmap_path: Path) -> dict[str, Any]:
    lines = roadmap_path.read_text(encoding="utf-8").splitlines()
    mapping_start_line, mapping_section = extract_section(lines, ROADMAP_SECTION_HEADING)
    excluded_start_line, excluded_section = extract_section(lines, EXCLUDED_SECTION_HEADING)

    mapped_rows: list[dict[str, Any]] = []
    issue_pattern = re.compile(r"^#(\d+)$")
    for offset, line in enumerate(mapping_section):
        stripped = line.strip()
        if not stripped.startswith("|"):
            continue
        if stripped.startswith("| issue ") or stripped.startswith("|---"):
            continue
        cells = [cell.strip() for cell in stripped.strip("|").split("|")]
        if len(cells) != 8:
            fail(f"unexpected mapping row shape at {roadmap_path}:{mapping_start_line + offset}: {line}")
        match = issue_pattern.match(cells[0])
        if not match:
            fail(f"unable to parse issue number in mapping row at {roadmap_path}:{mapping_start_line + offset}: {cells[0]}")
        mapped_rows.append(
            {
                "issue_number": int(match.group(1)),
                "line": mapping_start_line + offset,
                "raw": line,
                "cells": {
                    "issue": cells[0],
                    "lane_phase": cells[1],
                    "status": cells[2],
                    "owner": cells[3],
                    "dependency": cells[4],
                    "target_window": cells[5],
                    "last_updated": cells[6],
                    "unblock_ask": cells[7],
                },
            }
        )

    excluded_rows: list[dict[str, Any]] = []
    excluded_pattern = re.compile(r"^- #(\d+)\s+[—-]\s+(.+)$")
    for offset, line in enumerate(excluded_section):
        match = excluded_pattern.match(line.strip())
        if not match:
            continue
        excluded_rows.append(
            {
                "issue_number": int(match.group(1)),
                "line": excluded_start_line + offset,
                "rationale": match.group(2).strip(),
                "raw": line,
            }
        )

    return {
        "mapped_rows": mapped_rows,
        "excluded_rows": excluded_rows,
    }


def build_finding(
    *,
    drift_class: str,
    issue_number: int,
    trigger_mode: str,
    candidate_repo_file: str,
    details: str,
    title: str | None,
    url: str | None,
    roadmap_refs: list[int],
    excluded_refs: list[int],
) -> dict[str, Any]:
    rule = DRIFT_RULES[drift_class][trigger_mode]
    return {
        "subject": f"issue #{issue_number}",
        "issue_number": issue_number,
        "issue_title": title or "",
        "issue_url": url or "",
        "drift_class": drift_class,
        "trigger_mode": trigger_mode,
        "action_classification": {
            "action": rule["action"],
            "summary": rule["summary"],
            "safe_mutation_class": "artifact_only",
        },
        "candidate_touched_files": [candidate_repo_file],
        "roadmap_line_refs": roadmap_refs,
        "excluded_line_refs": excluded_refs,
        "blocker": rule["blocker"],
        "follow_up": rule["follow_up"],
        "details": details,
    }


def classify(
    open_issues: list[dict[str, Any]],
    roadmap: dict[str, Any],
    trigger_mode: str,
    candidate_repo_file: str,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], dict[str, int]]:
    open_by_number = {issue["number"]: issue for issue in open_issues}
    mapped_rows = roadmap["mapped_rows"]
    excluded_rows = roadmap["excluded_rows"]

    mapped_counts = Counter(row["issue_number"] for row in mapped_rows)
    excluded_counts = Counter(row["issue_number"] for row in excluded_rows)

    mapping_refs: dict[int, list[int]] = {}
    exclusion_refs: dict[int, list[int]] = {}
    for row in mapped_rows:
        mapping_refs.setdefault(row["issue_number"], []).append(row["line"])
    for row in excluded_rows:
        exclusion_refs.setdefault(row["issue_number"], []).append(row["line"])

    issue_statuses: list[dict[str, Any]] = []
    findings: list[dict[str, Any]] = []

    for issue in open_issues:
        number = issue["number"]
        mapped = mapped_counts[number]
        excluded = excluded_counts[number]
        tracking_state = "missing"
        action = "no_action"
        summary = "tracked_cleanly"

        if mapped > 0 and excluded > 0:
            tracking_state = "overlap"
        elif mapped > 1:
            tracking_state = "duplicate_mapping"
        elif excluded > 1:
            tracking_state = "duplicate_exclusion"
        elif mapped == 1:
            tracking_state = "mapped"
        elif excluded == 1:
            tracking_state = "excluded"

        per_issue_drifts: list[str] = []
        if mapped == 0 and excluded == 0:
            per_issue_drifts.append("missing_open_issue_tracking")
        if mapped > 1:
            per_issue_drifts.append("duplicate_mapping_rows")
        if excluded > 1:
            per_issue_drifts.append("duplicate_exclusion_entries")
        if mapped > 0 and excluded > 0:
            per_issue_drifts.append("overlap_mapped_and_excluded")

        if per_issue_drifts:
            primary_rule = DRIFT_RULES[per_issue_drifts[0]][trigger_mode]
            action = primary_rule["action"]
            summary = primary_rule["summary"]
            for drift_class in per_issue_drifts:
                findings.append(
                    build_finding(
                        drift_class=drift_class,
                        issue_number=number,
                        trigger_mode=trigger_mode,
                        candidate_repo_file=candidate_repo_file,
                        details=f"Open issue #{number} is in tracking state '{tracking_state}'.",
                        title=issue["title"],
                        url=issue["url"],
                        roadmap_refs=mapping_refs.get(number, []),
                        excluded_refs=exclusion_refs.get(number, []),
                    )
                )

        issue_statuses.append(
            {
                "issue_number": number,
                "title": issue["title"],
                "url": issue["url"],
                "tracking_state": tracking_state,
                "mapped_row_count": mapped,
                "excluded_entry_count": excluded,
                "action_classification": {
                    "action": action,
                    "summary": summary,
                },
            }
        )

    open_numbers = set(open_by_number)
    for issue_number, refs in sorted(mapping_refs.items()):
        if issue_number in open_numbers:
            continue
        findings.append(
            build_finding(
                drift_class="stale_mapping_closed_issue",
                issue_number=issue_number,
                trigger_mode=trigger_mode,
                candidate_repo_file=candidate_repo_file,
                details=f"Roadmap mapping row points at issue #{issue_number}, but that issue is not currently open in the compared issue set.",
                title=None,
                url=None,
                roadmap_refs=refs,
                excluded_refs=[],
            )
        )

    for issue_number, refs in sorted(exclusion_refs.items()):
        if issue_number in open_numbers:
            continue
        findings.append(
            build_finding(
                drift_class="stale_exclusion_closed_issue",
                issue_number=issue_number,
                trigger_mode=trigger_mode,
                candidate_repo_file=candidate_repo_file,
                details=f"Excluded issues list still contains closed issue #{issue_number}.",
                title=None,
                url=None,
                roadmap_refs=[],
                excluded_refs=refs,
            )
        )

    findings.sort(key=lambda finding: (finding["issue_number"], finding["drift_class"]))

    metrics = {
        "open_issue_count": len(open_issues),
        "mapped_row_count": len(mapped_rows),
        "excluded_issue_count": len(excluded_rows),
        "clean_mapped_issue_count": sum(1 for status in issue_statuses if status["tracking_state"] == "mapped"),
        "clean_excluded_issue_count": sum(1 for status in issue_statuses if status["tracking_state"] == "excluded"),
        "missing_open_issue_tracking_count": sum(1 for finding in findings if finding["drift_class"] == "missing_open_issue_tracking"),
        "duplicate_mapping_rows_count": sum(1 for finding in findings if finding["drift_class"] == "duplicate_mapping_rows"),
        "duplicate_exclusion_entries_count": sum(1 for finding in findings if finding["drift_class"] == "duplicate_exclusion_entries"),
        "overlap_mapped_and_excluded_count": sum(1 for finding in findings if finding["drift_class"] == "overlap_mapped_and_excluded"),
        "stale_mapping_closed_issue_count": sum(1 for finding in findings if finding["drift_class"] == "stale_mapping_closed_issue"),
        "stale_exclusion_closed_issue_count": sum(1 for finding in findings if finding["drift_class"] == "stale_exclusion_closed_issue"),
        "actionable_finding_count": len(findings),
    }

    return issue_statuses, findings, metrics


def render_markdown(report: dict[str, Any]) -> str:
    candidate_repo_file = report["guardrails"]["single_source_of_truth"]
    lines = [
        "# roadmap open-issue reconciliation artifact",
        "",
        "## subject",
        f"- repo: `{report['subject']['repo']}`",
        f"- roadmap: `{report['subject']['roadmap_path']}`",
        f"- trigger_mode: `{report['subject']['trigger_mode']}`",
        f"- generated_at_utc: `{report['generated_at_utc']}`",
        f"- issue_source: `{report['sources']['issue_source']}`",
        "",
        "## guardrails",
        f"- single_source_of_truth: `{candidate_repo_file}`",
        "- mutation_mode: `artifact_only`",
    ]
    for zone in NO_TOUCH_ZONES:
        lines.append(f"- no_touch_zone: {zone}")

    lines.extend(
        [
            "",
            "## metrics",
            "| metric | value |",
            "|---|---|",
        ]
    )
    for key, value in report["metrics"].items():
        lines.append(f"| {key} | {value} |")

    lines.extend(
        [
            "",
            "## issue coverage",
            "| issue | tracking_state | action |",
            "|---|---|---|",
        ]
    )
    for item in report["issue_statuses"]:
        lines.append(
            f"| #{item['issue_number']} | {item['tracking_state']} | {item['action_classification']['action']} / {item['action_classification']['summary']} |"
        )

    lines.extend(
        [
            "",
            "## findings",
            "| subject | drift_class | action | touched_file | next_step |",
            "|---|---|---|---|---|",
        ]
    )
    if report["findings"]:
        for finding in report["findings"]:
            next_step = finding["blocker"] or finding["follow_up"] or "none"
            lines.append(
                f"| issue #{finding['issue_number']} | {finding['drift_class']} | {finding['action_classification']['action']} / {finding['action_classification']['summary']} | `{candidate_repo_file}` | {next_step} |"
            )
    else:
        lines.append(f"| none | none | no_action | `{candidate_repo_file}` | none |")

    return "\n".join(lines) + "\n"


def write_artifact(path: Path, content: str) -> None:
    if path.exists():
        fail(f"immutable artifact already exists: {path}")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Reconcile ROADMAP_V1 open-issue mapping against GitHub open issues."
    )
    parser.add_argument("--repo", default="BoilerHAUS/moltch", help="GitHub repo slug owner/repo")
    parser.add_argument("--roadmap", default=ROADMAP_PATH_DEFAULT, help="Path to ROADMAP_V1 markdown")
    parser.add_argument("--issues-json", help="Optional JSON file for deterministic/offline issue input")
    parser.add_argument("--trigger-mode", required=True, choices=["pre-merge", "post-merge"])
    parser.add_argument("--artifact-dir", help="Directory for immutable JSON and Markdown artifacts")
    parser.add_argument("--write-json", help="Explicit immutable JSON artifact path")
    parser.add_argument("--write-md", help="Explicit immutable Markdown artifact path")
    parser.add_argument("--generated-at-utc", help="Optional ISO-8601 UTC timestamp for deterministic artifacts")
    parser.add_argument("--check", action="store_true", help="Exit non-zero when actionable drift is detected")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    generated_at = parse_generated_at(args.generated_at_utc)
    roadmap_path = Path(args.roadmap)
    if not roadmap_path.exists():
        fail(f"roadmap file not found: {roadmap_path}")

    open_issues = load_issue_payload(args.issues_json, args.repo)
    roadmap = parse_roadmap(roadmap_path)
    candidate_repo_file = str(roadmap_path)
    issue_statuses, findings, metrics = classify(open_issues, roadmap, args.trigger_mode, candidate_repo_file)

    touched_artifacts: list[str] = []
    stamp = sanitize_stamp(generated_at)
    artifact_base = f"roadmap_open_issue_reconciliation.{args.trigger_mode}.{stamp}"

    json_output_path: Path | None = None
    md_output_path: Path | None = None
    if args.artifact_dir:
        artifact_dir = Path(args.artifact_dir)
        json_output_path = artifact_dir / f"{artifact_base}.json"
        md_output_path = artifact_dir / f"{artifact_base}.md"
    if args.write_json:
        json_output_path = Path(args.write_json)
    if args.write_md:
        md_output_path = Path(args.write_md)

    report = {
        "schema_version": SCHEMA_VERSION,
        "generated_at_utc": generated_at,
        "subject": {
            "repo": args.repo,
            "roadmap_path": str(roadmap_path),
            "trigger_mode": args.trigger_mode,
            "scope": "ROADMAP_V1 canonical open-issue mapping reconciliation",
        },
        "sources": {
            "issue_source": f"fixture:{args.issues_json}" if args.issues_json else "gh api",
            "roadmap_source": str(roadmap_path),
        },
        "guardrails": {
            "single_source_of_truth": candidate_repo_file,
            "mutation_mode": "artifact_only",
            "safe_repo_files": [candidate_repo_file],
            "no_touch_zones": NO_TOUCH_ZONES,
        },
        "candidate_repo_files": [candidate_repo_file],
        "artifact_files": [],
        "blockers": [finding["blocker"] for finding in findings if finding["blocker"]],
        "follow_ups": [finding["follow_up"] for finding in findings if finding["follow_up"]],
        "metrics": metrics,
        "issue_statuses": issue_statuses,
        "findings": findings,
    }

    report["artifact_files"] = touched_artifacts
    if json_output_path:
        touched_artifacts.append(str(json_output_path))
    if md_output_path:
        touched_artifacts.append(str(md_output_path))

    report["artifact_files"] = touched_artifacts
    if json_output_path:
        write_artifact(json_output_path, json.dumps(report, indent=2) + "\n")
    if md_output_path:
        markdown = render_markdown(report)
        write_artifact(md_output_path, markdown)

    status = "clean" if not findings else "drift_detected"
    summary = {
        "status": status,
        "trigger_mode": args.trigger_mode,
        "open_issue_count": metrics["open_issue_count"],
        "actionable_finding_count": metrics["actionable_finding_count"],
        "artifact_files": touched_artifacts,
    }
    print(json.dumps(summary))

    if args.check and findings:
        raise SystemExit(2)


if __name__ == "__main__":
    main()
