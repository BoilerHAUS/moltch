#!/usr/bin/env python3
import argparse
import hashlib
import json
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict

SCRIPT_VERSION = "v1.2.0"
MANIFEST_SCHEMA_VERSION = "v2"

GITHUB_URL_RE = re.compile(r"^https://github\.com/[^\s]+$")
DOCS_PATH_RE = re.compile(r"^docs/[A-Za-z0-9._\-/]+$")

MANIFEST_ALLOWED_ROOT_KEYS = {
    "packet_id",
    "target_environment",
    "decision_rationale",
    "traceability",
    "evidence",
    "status_signals",
    "freshness",
}
MANIFEST_REQUIRED_ROOT_KEYS = {
    "packet_id",
    "target_environment",
    "traceability",
    "evidence",
    "status_signals",
    "freshness",
}
MANIFEST_ALLOWED_TRACEABILITY_KEYS = {"source_issue", "source_pull_requests"}
MANIFEST_REQUIRED_TRACEABILITY_KEYS = {"source_issue", "source_pull_requests"}
MANIFEST_ALLOWED_EVIDENCE_KEYS = {
    "launch_gate_schema_doc",
    "demo1_evidence_doc",
    "demo2_evidence_doc",
    "readiness_summary_json",
    "pilot_decision_memo_doc",
}
MANIFEST_REQUIRED_EVIDENCE_KEYS = MANIFEST_ALLOWED_EVIDENCE_KEYS.copy()
MANIFEST_ALLOWED_SIGNAL_KEYS = {
    "ci_required_checks_passed",
    "readiness_overall_verdict",
    "evidence_complete",
    "abort_gate_triggered",
    "source_data_age_hours",
    "source_commit_sha",
}
MANIFEST_REQUIRED_SIGNAL_KEYS = MANIFEST_ALLOWED_SIGNAL_KEYS.copy()
MANIFEST_ALLOWED_FRESHNESS_KEYS = {"max_source_age_hours", "require_same_commit_lineage"}
MANIFEST_REQUIRED_FRESHNESS_KEYS = MANIFEST_ALLOWED_FRESHNESS_KEYS.copy()


def fail(msg: str):
    print(f"[launch-packet][fail] {msg}", file=sys.stderr)
    sys.exit(1)


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def git_head_sha() -> str:
    try:
        return subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip()
    except Exception:
        return "unknown"


def git_blob_hash(path: Path) -> str:
    try:
        rel = str(path)
        return subprocess.check_output(["git", "hash-object", rel], text=True).strip()
    except Exception:
        return "unknown"


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        while True:
            chunk = f.read(8192)
            if not chunk:
                break
            h.update(chunk)
    return h.hexdigest()


def read_json(path: Path) -> Dict[str, Any]:
    try:
        with path.open() as f:
            return json.load(f)
    except Exception as e:
        fail(f"unable to parse JSON at {path}: {e}")


def ensure_keys(node: Dict[str, Any], required: set, allowed: set, ctx: str):
    missing = sorted(required - set(node.keys()))
    if missing:
        fail(f"{ctx} missing required keys: {missing}")
    extra = sorted(set(node.keys()) - allowed)
    if extra:
        fail(f"{ctx} contains unsupported keys (additionalProperties=false): {extra}")


def validate_github_url(url: str, field: str):
    if not isinstance(url, str) or not GITHUB_URL_RE.match(url):
        fail(f"{field} must be an https GitHub URL, got: {url}")


def normalize_repo_path(rel_path: str, field: str, repo_root: Path) -> Path:
    if not isinstance(rel_path, str) or not DOCS_PATH_RE.match(rel_path):
        fail(f"{field} must be a normalized docs/ relative path, got: {rel_path}")

    candidate = (repo_root / rel_path).resolve()
    if repo_root not in candidate.parents and candidate != repo_root:
        fail(f"{field} escapes repository root: {rel_path}")

    try:
        candidate.relative_to(repo_root)
    except Exception:
        fail(f"{field} not repository-relative after normalization: {rel_path}")

    if ".." in Path(rel_path).parts:
        fail(f"{field} must not contain traversal segments: {rel_path}")

    if not candidate.exists():
        fail(f"required evidence file missing: {rel_path}")

    return candidate


def validate_manifest(manifest: Dict[str, Any], repo_root: Path) -> None:
    if not isinstance(manifest, dict):
        fail("manifest root must be an object")

    ensure_keys(manifest, MANIFEST_REQUIRED_ROOT_KEYS, MANIFEST_ALLOWED_ROOT_KEYS, "$")

    if not isinstance(manifest["packet_id"], str) or not manifest["packet_id"].strip():
        fail("packet_id must be a non-empty string")

    if manifest["target_environment"] not in ("staging", "preprod", "prod-like"):
        fail("target_environment must be one of: staging|preprod|prod-like")

    trace = manifest["traceability"]
    if not isinstance(trace, dict):
        fail("traceability must be an object")
    ensure_keys(trace, MANIFEST_REQUIRED_TRACEABILITY_KEYS, MANIFEST_ALLOWED_TRACEABILITY_KEYS, "traceability")

    validate_github_url(trace["source_issue"], "traceability.source_issue")
    prs = trace["source_pull_requests"]
    if not isinstance(prs, list) or len(prs) == 0:
        fail("traceability.source_pull_requests must be a non-empty array")
    for idx, url in enumerate(prs):
        validate_github_url(url, f"traceability.source_pull_requests[{idx}]")

    evidence = manifest["evidence"]
    if not isinstance(evidence, dict):
        fail("evidence must be an object")
    ensure_keys(evidence, MANIFEST_REQUIRED_EVIDENCE_KEYS, MANIFEST_ALLOWED_EVIDENCE_KEYS, "evidence")
    for key, rel_path in evidence.items():
        normalize_repo_path(rel_path, f"evidence.{key}", repo_root)

    signals = manifest["status_signals"]
    if not isinstance(signals, dict):
        fail("status_signals must be an object")
    ensure_keys(signals, MANIFEST_REQUIRED_SIGNAL_KEYS, MANIFEST_ALLOWED_SIGNAL_KEYS, "status_signals")

    for key in ("ci_required_checks_passed", "evidence_complete", "abort_gate_triggered"):
        if not isinstance(signals[key], bool):
            fail(f"status_signals.{key} must be boolean")

    if signals["readiness_overall_verdict"] not in ("pass", "fail"):
        fail("status_signals.readiness_overall_verdict must be pass|fail")

    if not isinstance(signals["source_data_age_hours"], (int, float)) or signals["source_data_age_hours"] < 0:
        fail("status_signals.source_data_age_hours must be >=0 number")

    if not isinstance(signals["source_commit_sha"], str) or not signals["source_commit_sha"].strip():
        fail("status_signals.source_commit_sha must be non-empty string")

    freshness = manifest["freshness"]
    if not isinstance(freshness, dict):
        fail("freshness must be an object")
    ensure_keys(freshness, MANIFEST_REQUIRED_FRESHNESS_KEYS, MANIFEST_ALLOWED_FRESHNESS_KEYS, "freshness")

    if not isinstance(freshness["max_source_age_hours"], (int, float)) or freshness["max_source_age_hours"] < 0:
        fail("freshness.max_source_age_hours must be >=0 number")
    if not isinstance(freshness["require_same_commit_lineage"], bool):
        fail("freshness.require_same_commit_lineage must be boolean")


def derive_decision(manifest: Dict[str, Any], source_commit_sha: str) -> Dict[str, Any]:
    s = manifest["status_signals"]
    f = manifest["freshness"]

    same_commit_lineage = (s["source_commit_sha"] == source_commit_sha)
    stale_source = s["source_data_age_hours"] > f["max_source_age_hours"]

    evaluation = [
        {"signal": "evidence_complete", "value": s["evidence_complete"], "status": "pass" if s["evidence_complete"] else "fail", "impact": "missing evidence => no-go"},
        {"signal": "ci_required_checks_passed", "value": s["ci_required_checks_passed"], "status": "pass" if s["ci_required_checks_passed"] else "fail", "impact": "failed checks => no-go"},
        {"signal": "readiness_overall_verdict", "value": s["readiness_overall_verdict"], "status": "pass" if s["readiness_overall_verdict"] == "pass" else "fail", "impact": "readiness fail => no-go"},
        {"signal": "abort_gate_triggered", "value": s["abort_gate_triggered"], "status": "fail" if s["abort_gate_triggered"] else "pass", "impact": "abort gate => no-go"},
        {"signal": "source_data_age_hours", "value": s["source_data_age_hours"], "status": "fail" if stale_source else "pass", "impact": "stale inputs => hold"},
        {"signal": "same_commit_lineage", "value": same_commit_lineage, "status": "fail" if (f["require_same_commit_lineage"] and not same_commit_lineage) else "pass", "impact": "lineage mismatch => hold"},
    ]

    decision = "go"
    reasons = []

    if (not s["evidence_complete"] or not s["ci_required_checks_passed"] or s["readiness_overall_verdict"] == "fail" or s["abort_gate_triggered"]):
        decision = "no-go"
        if not s["evidence_complete"]:
            reasons.append("evidence_incomplete")
        if not s["ci_required_checks_passed"]:
            reasons.append("ci_checks_failed")
        if s["readiness_overall_verdict"] == "fail":
            reasons.append("readiness_failed")
        if s["abort_gate_triggered"]:
            reasons.append("abort_gate_triggered")
    elif stale_source or (f["require_same_commit_lineage"] and not same_commit_lineage):
        decision = "hold"
        if stale_source:
            reasons.append("source_data_stale")
        if f["require_same_commit_lineage"] and not same_commit_lineage:
            reasons.append("commit_lineage_mismatch")
    else:
        reasons.append("all_required_signals_green")

    return {
        "decision": decision,
        "reasons": reasons,
        "signal_evaluation": evaluation,
        "same_commit_lineage": same_commit_lineage,
        "stale_source": stale_source,
    }


def build_payload(
    manifest: Dict[str, Any],
    generated_at_utc: str,
    source_commit_sha: str,
    script_hash: str,
    manifest_hash: str,
) -> Dict[str, Any]:
    derived = derive_decision(manifest, source_commit_sha)

    return {
        "packet_id": manifest["packet_id"],
        "generated_at_utc": generated_at_utc,
        "source_commit_sha": source_commit_sha,
        "target_environment": manifest["target_environment"],
        "decision": derived["decision"],
        "decision_reasons": derived["reasons"],
        "decision_rationale": manifest.get("decision_rationale", ""),
        "traceability": manifest["traceability"],
        "evidence": manifest["evidence"],
        "status_signals": manifest["status_signals"],
        "freshness": manifest["freshness"],
        "signal_evaluation": derived["signal_evaluation"],
        "generator": {
            "script": "scripts/ops/build_launch_readiness_packet.py",
            "script_version": SCRIPT_VERSION,
            "script_git_blob_hash": script_hash,
            "manifest_schema_version": MANIFEST_SCHEMA_VERSION,
            "manifest_sha256": manifest_hash,
        },
    }


def write_json(path: Path, payload: Dict[str, Any]):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w") as f:
        json.dump(payload, f, indent=2, sort_keys=True)
        f.write("\n")


def write_markdown(path: Path, payload: Dict[str, Any]):
    e = payload["evidence"]
    t = payload["traceability"]
    g = payload["generator"]
    with path.open("w") as f:
        f.write("# launch-readiness packet\n\n")
        f.write(f"- packet_id: {payload['packet_id']}\n")
        f.write(f"- generated_at_utc: {payload['generated_at_utc']}\n")
        f.write(f"- source_commit_sha: `{payload['source_commit_sha']}`\n")
        f.write(f"- target_environment: {payload['target_environment']}\n")
        f.write(f"- decision (computed): **{payload['decision']}**\n")
        f.write(f"- decision_reasons: {', '.join(payload['decision_reasons'])}\n\n")

        if payload.get("decision_rationale"):
            f.write("## operator rationale (non-authoritative)\n")
            f.write(f"{payload['decision_rationale']}\n\n")

        f.write("## traceability\n")
        f.write(f"- issue: {t['source_issue']}\n")
        for i, pr in enumerate(t["source_pull_requests"], 1):
            f.write(f"- PR {i}: {pr}\n")
        f.write("\n")

        f.write("## required evidence\n")
        for k, v in e.items():
            f.write(f"- {k}: `{v}`\n")
        f.write("\n")

        f.write("## signal evaluation\n")
        for sig in payload["signal_evaluation"]:
            f.write(f"- {sig['signal']}: value=`{sig['value']}` status=`{sig['status']}` impact=`{sig['impact']}`\n")
        f.write("\n")

        f.write("## generator metadata\n")
        f.write(f"- script: `{g['script']}`\n")
        f.write(f"- script_version: {g['script_version']}\n")
        f.write(f"- script_git_blob_hash: `{g['script_git_blob_hash']}`\n")
        f.write(f"- manifest_schema_version: {g['manifest_schema_version']}\n")
        f.write(f"- manifest_sha256: `{g['manifest_sha256']}`\n")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--out-dir", required=True)
    parser.add_argument("--generated-at-utc")
    parser.add_argument("--source-commit-sha")
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parents[2]
    manifest_path = (repo_root / args.manifest).resolve()
    if not manifest_path.exists():
        fail(f"manifest not found: {args.manifest}")

    manifest = read_json(manifest_path)
    validate_manifest(manifest, repo_root)

    generated_at = args.generated_at_utc or utc_now_iso()
    source_sha = args.source_commit_sha or git_head_sha()

    script_path = Path(__file__).resolve()
    script_hash = git_blob_hash(script_path.relative_to(repo_root))
    manifest_hash = sha256_file(manifest_path)

    payload = build_payload(
        manifest,
        generated_at,
        source_sha,
        script_hash=script_hash,
        manifest_hash=manifest_hash,
    )

    out_dir = (repo_root / args.out_dir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    json_path = out_dir / "launch_readiness_packet.json"
    md_path = out_dir / "launch_readiness_packet.md"

    write_json(json_path, payload)
    write_markdown(md_path, payload)

    print(f"[launch-packet][pass] wrote {json_path.relative_to(repo_root)}")
    print(f"[launch-packet][pass] wrote {md_path.relative_to(repo_root)}")


if __name__ == "__main__":
    main()
