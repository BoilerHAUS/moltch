#!/usr/bin/env python3
import argparse
import json
import re
import sys
from datetime import datetime
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

ROADMAP_SECTION_HEADING = "## open issues mapping (canonical)"
EXCLUDED_SECTION_HEADING = "## excluded issues"
ARTIFACT_VERSION = "issue_classification_status.v1"
CLASSIFICATION_STATES = {
    "planned",
    "active_delivery_candidate",
    "active_delivery",
    "excluded",
}
CLASSIFICATION_SOURCES = {
    "auto_roadmap",
    "auto_exclusion",
    "manual",
}
ADMISSION_STATUSES = {
    "not_admitted",
    "blocked",
    "admitted",
}


def _is_iso8601_utc(value: object) -> bool:
    if not isinstance(value, str):
        return False
    try:
        datetime.fromisoformat(value.replace("Z", "+00:00"))
        return True
    except ValueError:
        return False


def _is_url(value: object) -> bool:
    if not isinstance(value, str) or not value:
        return False
    parsed = urlparse(value)
    return parsed.scheme in {"http", "https"} and bool(parsed.netloc)


def _extract_section(lines: list[str], heading: str) -> tuple[int, list[str]]:
    start = -1
    for index, line in enumerate(lines):
        if line.strip().startswith(heading):
            start = index + 1
            break
    if start == -1:
        raise ValueError(f"missing roadmap section: {heading}")

    section: list[str] = []
    for line in lines[start:]:
        if line.startswith("## "):
            break
        section.append(line.rstrip("\n"))
    return start + 1, section


def parse_roadmap(roadmap_path: Path) -> dict[str, set[int]]:
    lines = roadmap_path.read_text(encoding="utf-8").splitlines()
    _, mapping_section = _extract_section(lines, ROADMAP_SECTION_HEADING)
    _, excluded_section = _extract_section(lines, EXCLUDED_SECTION_HEADING)

    mapped_numbers: set[int] = set()
    issue_pattern = re.compile(r"^#(\d+)$")
    for line in mapping_section:
        stripped = line.strip()
        if not stripped.startswith("|"):
            continue
        if stripped.startswith("| issue ") or stripped.startswith("|---"):
            continue
        cells = [cell.strip() for cell in stripped.strip("|").split("|")]
        if len(cells) != 8:
            raise ValueError(f"unexpected mapping row shape: {line}")
        match = issue_pattern.match(cells[0])
        if not match:
            raise ValueError(f"unable to parse issue number in mapping row: {line}")
        mapped_numbers.add(int(match.group(1)))

    excluded_numbers: set[int] = set()
    excluded_pattern = re.compile(r"^- #(\d+)\s+[—-]\s+(.+)$")
    for line in excluded_section:
        match = excluded_pattern.match(line.strip())
        if match:
            excluded_numbers.add(int(match.group(1)))

    return {
        "mapped": mapped_numbers,
        "excluded": excluded_numbers,
    }


def validate_artifact(payload: Any, roadmap_state: dict[str, set[int]], label: str) -> list[str]:
    errors: list[str] = []
    if not isinstance(payload, dict):
        return [f"{label}: root must be a JSON object"]

    if payload.get("artifact_version") != ARTIFACT_VERSION:
        errors.append(f"{label}: artifact_version must be '{ARTIFACT_VERSION}'")
    if not _is_iso8601_utc(payload.get("generated_at_utc")):
        errors.append(f"{label}: generated_at_utc must be an ISO8601 timestamp")

    issues = payload.get("issues")
    if not isinstance(issues, list):
        errors.append(f"{label}: issues must be an array")
        return errors

    seen_numbers: set[int] = set()
    for index, item in enumerate(issues):
        prefix = f"{label}: $.issues[{index}]"
        if not isinstance(item, dict):
            errors.append(f"{prefix}: item must be an object")
            continue

        issue_number = item.get("issue_number")
        if not isinstance(issue_number, int) or issue_number <= 0:
            errors.append(f"{prefix}.issue_number: must be a positive integer")
            continue
        if issue_number in seen_numbers:
            errors.append(f"{prefix}.issue_number: duplicate issue_number {issue_number}")
            continue
        seen_numbers.add(issue_number)

        classification = item.get("classification")
        admission = item.get("pr_admission")
        pull_request_url = item.get("pull_request_url")

        if not isinstance(classification, dict):
            errors.append(f"{prefix}.classification: must be an object")
            continue
        if not isinstance(admission, dict):
            errors.append(f"{prefix}.pr_admission: must be an object")
            continue

        state = classification.get("state")
        source = classification.get("source")
        rationale = classification.get("rationale")
        status = admission.get("status")
        ready_for_pr = admission.get("ready_for_pr")
        basis = admission.get("basis")
        decided_by = admission.get("decided_by")
        decided_at_utc = admission.get("decided_at_utc")

        if state not in CLASSIFICATION_STATES:
            errors.append(f"{prefix}.classification.state: invalid state '{state}'")
        if source not in CLASSIFICATION_SOURCES:
            errors.append(f"{prefix}.classification.source: invalid source '{source}'")
        if not isinstance(rationale, str) or not rationale.strip():
            errors.append(f"{prefix}.classification.rationale: must be a non-empty string")
        if status not in ADMISSION_STATUSES:
            errors.append(f"{prefix}.pr_admission.status: invalid status '{status}'")
        if not isinstance(ready_for_pr, bool):
            errors.append(f"{prefix}.pr_admission.ready_for_pr: must be a boolean")

        if pull_request_url not in (None, "") and not _is_url(pull_request_url):
            errors.append(f"{prefix}.pull_request_url: must be an http(s) URL when provided")
        if decided_at_utc not in (None, "") and not _is_iso8601_utc(decided_at_utc):
            errors.append(f"{prefix}.pr_admission.decided_at_utc: must be an ISO8601 timestamp when provided")

        if issue_number in roadmap_state["mapped"] and issue_number in roadmap_state["excluded"]:
            errors.append(f"{prefix}: issue #{issue_number} cannot be both mapped and excluded in roadmap truth")
            continue
        if issue_number in roadmap_state["mapped"]:
            canonical_state = "mapped"
        elif issue_number in roadmap_state["excluded"]:
            canonical_state = "excluded"
        else:
            canonical_state = "untracked"

        if canonical_state == "untracked":
            errors.append(f"{prefix}: issue #{issue_number} is absent from roadmap mapping and canonical exclusion artifact")
            continue

        if canonical_state == "excluded":
            if state != "excluded":
                errors.append(f"{prefix}: excluded issue #{issue_number} must use classification.state='excluded'")
            if source == "auto_roadmap":
                errors.append(f"{prefix}: excluded issue #{issue_number} cannot use auto_roadmap classification")
            if status != "not_admitted" or ready_for_pr is not False:
                errors.append(f"{prefix}: excluded issue #{issue_number} cannot be admitted to the PR lane")
            if pull_request_url not in (None, ""):
                errors.append(f"{prefix}: excluded issue #{issue_number} must not rely on a PR URL")
            if basis not in (None, "") or decided_by not in (None, "") or decided_at_utc not in (None, ""):
                errors.append(f"{prefix}: excluded issue #{issue_number} must not carry PR-admission decision fields")
            continue

        if source == "auto_exclusion":
            errors.append(f"{prefix}: mapped issue #{issue_number} cannot use auto_exclusion classification")

        if state == "planned":
            if status != "not_admitted" or ready_for_pr is not False:
                errors.append(f"{prefix}: planned issue #{issue_number} must stay out of the PR lane")
            if basis not in (None, "") or decided_by not in (None, "") or decided_at_utc not in (None, ""):
                errors.append(f"{prefix}: planned issue #{issue_number} must not carry PR-admission decision fields")
            if pull_request_url not in (None, ""):
                errors.append(f"{prefix}: PR existence does not satisfy readiness for planned issue #{issue_number}")
        elif state == "active_delivery_candidate":
            if source != "manual":
                errors.append(f"{prefix}: active_delivery_candidate for issue #{issue_number} must be manual")
            if ready_for_pr is not False:
                errors.append(f"{prefix}: active_delivery_candidate for issue #{issue_number} cannot be ready_for_pr=true")
            if status not in {"not_admitted", "blocked"}:
                errors.append(f"{prefix}: active_delivery_candidate for issue #{issue_number} must be not_admitted or blocked")
            if status == "blocked":
                if not isinstance(basis, str) or not basis.strip():
                    errors.append(f"{prefix}: blocked active_delivery_candidate for issue #{issue_number} requires pr_admission.basis")
                if not isinstance(decided_by, str) or not decided_by.strip():
                    errors.append(f"{prefix}: blocked active_delivery_candidate for issue #{issue_number} requires pr_admission.decided_by")
                if not isinstance(decided_at_utc, str) or not decided_at_utc.strip():
                    errors.append(f"{prefix}: blocked active_delivery_candidate for issue #{issue_number} requires pr_admission.decided_at_utc")
            elif basis not in (None, "") or decided_by not in (None, "") or decided_at_utc not in (None, ""):
                errors.append(f"{prefix}: not_admitted active_delivery_candidate for issue #{issue_number} must not carry decision fields")
            if pull_request_url not in (None, ""):
                errors.append(f"{prefix}: PR existence does not satisfy readiness for active_delivery_candidate issue #{issue_number}")
        elif state == "active_delivery":
            if source != "manual":
                errors.append(f"{prefix}: active_delivery for issue #{issue_number} must be manual")
            if status != "admitted" or ready_for_pr is not True:
                errors.append(f"{prefix}: active_delivery for issue #{issue_number} requires explicit admitted + ready_for_pr=true")
            if not isinstance(basis, str) or not basis.strip():
                errors.append(f"{prefix}: active_delivery for issue #{issue_number} requires pr_admission.basis")
            if not isinstance(decided_by, str) or not decided_by.strip():
                errors.append(f"{prefix}: active_delivery for issue #{issue_number} requires pr_admission.decided_by")
            if not isinstance(decided_at_utc, str) or not decided_at_utc.strip():
                errors.append(f"{prefix}: active_delivery for issue #{issue_number} requires pr_admission.decided_at_utc")
        elif state == "excluded":
            errors.append(f"{prefix}: mapped issue #{issue_number} cannot use classification.state='excluded'")

    return errors


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Validate explicit issue-classification and PR-admission artifacts against ROADMAP_V1 canonical truth."
    )
    parser.add_argument("--roadmap", required=True)
    parser.add_argument("--input", action="append", dest="inputs", default=[])
    args = parser.parse_args()

    if not args.inputs:
        print("[issue-classification][fail] no input files provided", file=sys.stderr)
        raise SystemExit(1)

    roadmap_path = Path(args.roadmap)
    if not roadmap_path.exists():
        print(f"[issue-classification][fail] roadmap not found: {roadmap_path}", file=sys.stderr)
        raise SystemExit(1)

    try:
        roadmap_state = parse_roadmap(roadmap_path)
    except ValueError as exc:
        print(f"[issue-classification][fail] {exc}", file=sys.stderr)
        raise SystemExit(1)

    all_errors: list[str] = []
    for input_path in args.inputs:
        path = Path(input_path)
        if not path.exists():
            all_errors.append(f"{path}: file not found")
            continue
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            all_errors.append(f"{path}: failed to parse JSON ({exc})")
            continue
        all_errors.extend(validate_artifact(payload, roadmap_state, str(path)))

    if all_errors:
        for error in all_errors:
            print(f"[issue-classification][fail] {error}", file=sys.stderr)
        raise SystemExit(1)

    for input_path in args.inputs:
        print(f"[issue-classification][pass] {input_path}")


if __name__ == "__main__":
    main()
