#!/usr/bin/env python3
import argparse
import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

ARTIFACT_VERSION = "context_boundary_handoff.v1"
ALLOWED_DOMAINS = {
    "private_agent",
    "task_shared",
    "team_shared",
    "public_artifact",
    "quarantine",
}
ALLOWED_CLASSIFICATIONS = {
    "agent_private",
    "task_scoped_internal",
    "team_internal",
    "public_publishable",
}
ALLOWED_OUTCOMES = {
    "accepted_as_external_assertion",
    "quarantined",
    "rejected",
}
ALLOWED_CROSSINGS = {
    ("private_agent", "task_shared", "task_scoped_internal"),
    ("task_shared", "team_shared", "team_internal"),
    ("task_shared", "public_artifact", "public_publishable"),
    ("team_shared", "public_artifact", "public_publishable"),
}
REQUIRED_STRING_FIELDS = {
    "handoff_id",
    "trace_id",
    "source_domain",
    "target_domain",
    "sender",
    "receiver",
    "purpose",
    "classification",
    "policy_basis",
    "import_outcome",
    "content_summary",
}


def is_iso8601(value: object) -> bool:
    if not isinstance(value, str):
        return False
    try:
        datetime.fromisoformat(value.replace("Z", "+00:00"))
        return True
    except ValueError:
        return False


def validate_payload(payload: Any, label: str) -> list[str]:
    errors: list[str] = []
    if not isinstance(payload, dict):
        return [f"{label}: root must be a JSON object"]

    if payload.get("artifact_version") != ARTIFACT_VERSION:
        errors.append(f"{label}: artifact_version must be '{ARTIFACT_VERSION}'")
    if not is_iso8601(payload.get("generated_at_utc")):
        errors.append(f"{label}: generated_at_utc must be an ISO8601 timestamp")

    for field in REQUIRED_STRING_FIELDS:
        value = payload.get(field)
        if not isinstance(value, str) or not value.strip():
            errors.append(f"{label}: {field} must be a non-empty string")

    source = payload.get("source_domain")
    target = payload.get("target_domain")
    classification = payload.get("classification")
    outcome = payload.get("import_outcome")
    promoted = payload.get("promoted_to_native_truth", False)

    if isinstance(source, str) and source not in ALLOWED_DOMAINS:
        errors.append(f"{label}: unknown source_domain '{source}'")
    if isinstance(target, str) and target not in ALLOWED_DOMAINS:
        errors.append(f"{label}: unknown target_domain '{target}'")
    if isinstance(classification, str) and classification not in ALLOWED_CLASSIFICATIONS:
        errors.append(f"{label}: unknown classification '{classification}'")
    if isinstance(outcome, str) and outcome not in ALLOWED_OUTCOMES:
        errors.append(f"{label}: unknown import_outcome '{outcome}'")
    if not isinstance(promoted, bool):
        errors.append(f"{label}: promoted_to_native_truth must be a boolean when provided")

    if errors:
        return errors

    if target == "quarantine":
        if outcome != "quarantined":
            errors.append(f"{label}: target_domain=quarantine requires import_outcome='quarantined'")
    else:
        if (source, target, classification) not in ALLOWED_CROSSINGS:
            errors.append(
                f"{label}: deny-by-default crossing not allowed for {source} -> {target} with classification {classification}"
            )

    if outcome == "accepted_as_external_assertion" and promoted:
        errors.append(
            f"{label}: accepted_as_external_assertion cannot be promoted to native/shared truth in the same handoff"
        )
    if outcome in {"quarantined", "rejected"} and promoted:
        errors.append(f"{label}: {outcome} handoff cannot set promoted_to_native_truth=true")

    return errors


def main() -> None:
    parser = argparse.ArgumentParser(description="Validate context boundary handoff artifacts.")
    parser.add_argument("--input", action="append", dest="inputs", default=[])
    args = parser.parse_args()

    if not args.inputs:
        print("[context-boundary][fail] no input files provided", file=sys.stderr)
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
            print(f"[context-boundary][fail] {error}", file=sys.stderr)
        raise SystemExit(1)

    for input_path in args.inputs:
        print(f"[context-boundary][pass] {input_path}")


if __name__ == "__main__":
    main()
