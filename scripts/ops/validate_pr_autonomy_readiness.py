#!/usr/bin/env python3
import argparse
import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

ARTIFACT_VERSION = "pr_autonomy_readiness.v1"
VALID_STATES = {
    "discussion_only",
    "implementation_ready",
    "auto_pr_opened",
    "blocked_needs_human",
    "merged_or_closed",
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


def validate_payload(payload: Any, label: str) -> list[str]:
    errors: list[str] = []
    if not isinstance(payload, dict):
        return [f"{label}: root must be a JSON object"]

    if payload.get("artifact_version") != ARTIFACT_VERSION:
        errors.append(f"{label}: artifact_version must be '{ARTIFACT_VERSION}'")
    if not _is_iso8601_utc(payload.get("generated_at_utc")):
        errors.append(f"{label}: generated_at_utc must be an ISO8601 timestamp")

    issue_number = payload.get("issue_number")
    if not isinstance(issue_number, int) or issue_number <= 0:
        errors.append(f"{label}: issue_number must be a positive integer")

    state = payload.get("state")
    if state not in VALID_STATES:
        errors.append(f"{label}: state must be one of {sorted(VALID_STATES)}")

    ready = payload.get("ready")
    if not isinstance(ready, bool):
        errors.append(f"{label}: ready must be a boolean")

    reasons = payload.get("reasons")
    if not isinstance(reasons, list) or not reasons or any(not isinstance(item, str) or not item.strip() for item in reasons):
        errors.append(f"{label}: reasons must be a non-empty array of non-empty strings")

    thread_signals = payload.get("thread_signals")
    if not isinstance(thread_signals, dict):
        errors.append(f"{label}: thread_signals must be an object")
        return errors

    required_signal_keys = [
        "acceptance_criteria_explicit",
        "scope_bounded",
        "policy_ambiguity_resolved",
        "rollback_noted",
    ]
    for key in required_signal_keys:
        if not isinstance(thread_signals.get(key), bool):
            errors.append(f"{label}: thread_signals.{key} must be a boolean")

    existing_pr_url = payload.get("existing_pr_url")
    if existing_pr_url not in (None, "") and not _is_url(existing_pr_url):
        errors.append(f"{label}: existing_pr_url must be an http(s) URL when provided")

    if errors:
        return errors

    signals_ready = all(thread_signals[key] for key in required_signal_keys)

    if ready and not signals_ready:
        errors.append(f"{label}: ready=true requires all readiness signals to be true")

    if state == "discussion_only":
        if ready:
            errors.append(f"{label}: discussion_only cannot be ready=true")
    elif state == "implementation_ready":
        if not ready:
            errors.append(f"{label}: implementation_ready must set ready=true")
    elif state == "auto_pr_opened":
        if not ready:
            errors.append(f"{label}: auto_pr_opened must keep ready=true")
        if existing_pr_url in (None, ""):
            errors.append(f"{label}: auto_pr_opened requires existing_pr_url")
    elif state == "blocked_needs_human":
        if ready:
            errors.append(f"{label}: blocked_needs_human cannot be ready=true")
    elif state == "merged_or_closed":
        if ready:
            errors.append(f"{label}: merged_or_closed cannot be ready=true")

    if existing_pr_url not in (None, "") and state == "implementation_ready":
        errors.append(f"{label}: implementation_ready must not claim an existing PR URL before autonomous open")

    return errors


def main() -> None:
    parser = argparse.ArgumentParser(description="Validate repo-local PR autonomy readiness artifacts.")
    parser.add_argument("--input", action="append", dest="inputs", default=[])
    args = parser.parse_args()

    if not args.inputs:
        print("[pr-autonomy][fail] no input files provided", file=sys.stderr)
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
        all_errors.extend(validate_payload(payload, str(path)))

    if all_errors:
        for error in all_errors:
            print(f"[pr-autonomy][fail] {error}", file=sys.stderr)
        raise SystemExit(1)

    for input_path in args.inputs:
        print(f"[pr-autonomy][pass] {input_path}")


if __name__ == "__main__":
    main()
