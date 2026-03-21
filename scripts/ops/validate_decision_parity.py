#!/usr/bin/env python3
import argparse
import json
from pathlib import Path

REQUIRED_KEYS = {
    "decision_id",
    "correlation_id",
    "lineage_id",
    "from_state",
    "to_state",
    "result",
    "reason_code",
    "lane",
    "risk_class",
}

MISMATCH_TYPES = {
    "missing_required_field",
    "lineage_correlation_mismatch",
    "state_transition_mismatch",
    "verdict_reason_mismatch",
    "lane_risk_mismatch",
}

FAIL_CLOSED_LANES = {"launch-gate"}
FAIL_CLOSED_RISKS = {"treasury-critical"}


def load_json(path_str):
    path = Path(path_str)
    if not path.exists():
        raise SystemExit(f"[decision-parity][fail] missing input: {path}")
    return json.loads(path.read_text())


def normalize(payload):
    normalized = dict(payload)
    normalized.setdefault("metadata", {})
    normalized.setdefault("notes", "")
    normalized.setdefault("extra_context", {})
    for key, value in list(normalized.items()):
        if isinstance(value, str):
            normalized[key] = value.strip()
    return normalized


def classify_mismatch(offchain, onchain):
    missing = sorted([key for key in REQUIRED_KEYS if key not in offchain or key not in onchain])
    if missing:
        return "missing_required_field", {"missing_keys": missing}
    if offchain["decision_id"] != onchain["decision_id"] or offchain["correlation_id"] != onchain["correlation_id"] or offchain["lineage_id"] != onchain["lineage_id"]:
        return "lineage_correlation_mismatch", {}
    if offchain["from_state"] != onchain["from_state"] or offchain["to_state"] != onchain["to_state"]:
        return "state_transition_mismatch", {}
    if offchain["result"] != onchain["result"] or offchain["reason_code"] != onchain["reason_code"]:
        return "verdict_reason_mismatch", {}
    if offchain["lane"] != onchain["lane"] or offchain["risk_class"] != onchain["risk_class"]:
        return "lane_risk_mismatch", {}
    return None, {}


def parity_verdict(normalized_offchain, normalized_onchain):
    mismatch_type, details = classify_mismatch(normalized_offchain, normalized_onchain)
    fail_closed = (
        normalized_offchain.get("lane") in FAIL_CLOSED_LANES
        or normalized_offchain.get("risk_class") in FAIL_CLOSED_RISKS
    )
    if mismatch_type is None:
        return "pass", [], fail_closed, details
    verdict = "fail_closed" if fail_closed else "fail_open"
    return verdict, [mismatch_type], fail_closed, details


def main():
    ap = argparse.ArgumentParser(description="Validate semantic parity between off-chain and on-chain decision payloads")
    ap.add_argument("--input", required=True, help="fixture json containing offchain and onchain payloads")
    ap.add_argument("--write-json")
    ap.add_argument("--write-md")
    args = ap.parse_args()

    fixture = load_json(args.input)
    offchain = normalize(fixture["offchain"])
    onchain = normalize(fixture["onchain"])
    verdict, mismatch_types, fail_closed, details = parity_verdict(offchain, onchain)

    for mismatch in mismatch_types:
        if mismatch not in MISMATCH_TYPES:
            raise SystemExit(f"[decision-parity][fail] unknown mismatch classification: {mismatch}")

    result = {
        "schema_version": "decision_parity_validation.v1",
        "fixture_name": fixture.get("fixture_name", Path(args.input).name),
        "normalized_offchain": offchain,
        "normalized_onchain": onchain,
        "parity_verdict": verdict,
        "mismatch_types": mismatch_types,
        "fail_behavior": "fail_closed" if fail_closed else "fail_open",
        "details": details,
    }

    if args.write_json:
        Path(args.write_json).write_text(json.dumps(result, indent=2) + "\n")
    if args.write_md:
        md = [
            "# decision parity validation result",
            "",
            f"- fixture: `{result['fixture_name']}`",
            f"- parity_verdict: `{result['parity_verdict']}`",
            f"- fail_behavior: `{result['fail_behavior']}`",
            f"- mismatch_types: `{', '.join(result['mismatch_types']) if result['mismatch_types'] else 'none'}`",
        ]
        Path(args.write_md).write_text("\n".join(md) + "\n")

    print(json.dumps(result))
    if verdict != "pass":
        raise SystemExit(1)


if __name__ == "__main__":
    main()
