#!/usr/bin/env python3
import argparse
import json
import os
import re
import sys
from datetime import datetime, timezone


def now_iso(override=None):
    if override:
        return override
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def load_reason_codes(catalog_path: str):
    with open(catalog_path) as f:
        text = f.read()

    # Parse first column of markdown table rows in deterministic reason-code table.
    codes = set()
    in_table = False
    for line in text.splitlines():
        if line.strip().lower().startswith("## deterministic reason-code table"):
            in_table = True
            continue
        if in_table and line.strip().startswith("## "):
            break
        if in_table and line.strip().startswith("|"):
            cols = [c.strip() for c in line.strip().strip("|").split("|")]
            if not cols:
                continue
            first = cols[0]
            if first in ("reason_code", "---"):
                continue
            if re.match(r"^[a-z0-9_]+$", first):
                codes.add(first)
    return codes


def validate_case(case, known_reason_codes):
    errors = []
    for key in [
        "id",
        "action_class",
        "expected_decision",
        "expected_reason_code",
        "expected_policy_outcome",
        "expected_operator_action",
        "actual",
    ]:
        if key not in case:
            errors.append(f"missing required field: {key}")

    action = case.get("action_class")
    if action not in ("A0", "A1", "A2", "A3"):
        errors.append(f"invalid action_class: {action}")

    expected_decision = case.get("expected_decision")
    if expected_decision not in ("allow", "deny", "blocked_needs_human"):
        errors.append(f"invalid expected_decision: {expected_decision}")

    expected_rc = case.get("expected_reason_code")
    if expected_rc not in known_reason_codes:
        errors.append(f"unknown expected_reason_code (not in catalog): {expected_rc}")

    actual = case.get("actual", {}) if isinstance(case.get("actual"), dict) else {}

    comparisons = [
        ("decision", expected_decision),
        ("reason_code", case.get("expected_reason_code")),
        ("policy_outcome", case.get("expected_policy_outcome")),
        ("operator_action", case.get("expected_operator_action")),
    ]

    for field, expected_value in comparisons:
        observed = actual.get(field)
        if observed is None:
            errors.append(f"actual.{field} missing")
        elif observed != expected_value:
            errors.append(f"actual.{field} mismatch: expected '{expected_value}', got '{observed}'")

    return errors


def render_markdown(summary):
    lines = []
    lines.append("# policy decision conformance summary")
    lines.append("")
    lines.append(f"- generated_at_utc: {summary['generated_at_utc']}")
    lines.append(f"- suite_version: {summary['suite_version']}")
    lines.append(f"- total_cases: {summary['total_cases']}")
    lines.append(f"- pass_cases: {summary['pass_cases']}")
    lines.append(f"- fail_cases: {summary['fail_cases']}")
    lines.append(f"- requires_human_cases: {summary['requires_human_cases']}")
    lines.append(f"- overall_result: **{summary['overall_result']}**")
    lines.append("")
    lines.append("## case results")
    lines.append("| case_id | action_class | result | notes |")
    lines.append("|---|---|---|---|")
    for c in summary["case_results"]:
        notes = "; ".join(c["errors"]) if c["errors"] else "ok"
        lines.append(f"| {c['id']} | {c['action_class']} | {c['result']} | {notes} |")
    return "\n".join(lines) + "\n"


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--fixtures", required=True)
    p.add_argument("--catalog", required=True)
    p.add_argument("--out-json", required=True)
    p.add_argument("--out-md", required=True)
    p.add_argument("--generated-at-utc", default=None)
    args = p.parse_args()

    with open(args.fixtures) as f:
        payload = json.load(f)

    cases = payload.get("cases", [])
    if not cases:
        print("[policy-conformance][fail] no cases found", file=sys.stderr)
        sys.exit(1)

    known_reason_codes = load_reason_codes(args.catalog)
    if not known_reason_codes:
        print("[policy-conformance][fail] could not extract reason codes from catalog", file=sys.stderr)
        sys.exit(1)

    results = []
    pass_count = 0
    requires_human_count = 0

    for case in cases:
        errs = validate_case(case, known_reason_codes)
        if case.get("expected_decision") == "blocked_needs_human":
            requires_human_count += 1
        result = "pass" if not errs else "fail"
        if result == "pass":
            pass_count += 1
        results.append(
            {
                "id": case.get("id", "unknown"),
                "action_class": case.get("action_class", "unknown"),
                "result": result,
                "errors": errs,
            }
        )

    if requires_human_count < 1:
        results.append(
            {
                "id": "suite-requirement",
                "action_class": "A3",
                "result": "fail",
                "errors": ["suite must include at least one blocked_needs_human case"],
            }
        )

    fail_count = sum(1 for r in results if r["result"] == "fail")

    summary = {
        "generated_at_utc": now_iso(args.generated_at_utc),
        "suite_version": payload.get("suite_version", "unknown"),
        "total_cases": len(cases),
        "pass_cases": pass_count,
        "fail_cases": fail_count,
        "requires_human_cases": requires_human_count,
        "overall_result": "pass" if fail_count == 0 else "fail",
        "case_results": results,
    }

    os.makedirs(os.path.dirname(args.out_json), exist_ok=True)
    os.makedirs(os.path.dirname(args.out_md), exist_ok=True)

    with open(args.out_json, "w") as f:
        json.dump(summary, f, indent=2)
        f.write("\n")

    with open(args.out_md, "w") as f:
        f.write(render_markdown(summary))

    print(f"[policy-conformance][{summary['overall_result']}] {args.out_json}")
    print(f"[policy-conformance][{summary['overall_result']}] {args.out_md}")

    if summary["overall_result"] != "pass":
        sys.exit(1)


if __name__ == "__main__":
    main()
