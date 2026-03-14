#!/usr/bin/env python3
import argparse
import json
import os
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List

GITHUB_URL_RE = re.compile(r"^https://github\.com/[^\s]+$")

REQUIRED_ROOT_KEYS = [
    "packet_id",
    "target_environment",
    "decision",
    "traceability",
    "evidence",
]

REQUIRED_TRACEABILITY_KEYS = ["source_issue", "source_pull_requests"]
REQUIRED_EVIDENCE_KEYS = [
    "launch_gate_schema_doc",
    "demo1_evidence_doc",
    "demo2_evidence_doc",
    "readiness_summary_json",
    "pilot_decision_memo_doc",
]


def fail(msg: str):
    print(f"[launch-packet][fail] {msg}", file=sys.stderr)
    sys.exit(1)


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def git_head_sha() -> str:
    try:
        return (
            subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip()
        )
    except Exception:
        return "unknown"


def read_json(path: Path) -> Dict[str, Any]:
    try:
        with path.open() as f:
            return json.load(f)
    except Exception as e:
        fail(f"unable to parse manifest JSON at {path}: {e}")


def require_keys(node: Dict[str, Any], keys: List[str], ctx: str):
    for k in keys:
        if k not in node:
            fail(f"manifest missing required key '{ctx}.{k}'")


def validate_github_url(url: str, field: str):
    if not isinstance(url, str) or not GITHUB_URL_RE.match(url):
        fail(f"{field} must be a valid GitHub URL, got: {url}")


def validate_manifest(manifest: Dict[str, Any], repo_root: Path):
    require_keys(manifest, REQUIRED_ROOT_KEYS, "$")

    if manifest["target_environment"] not in ("staging", "preprod", "prod-like"):
        fail("target_environment must be one of: staging|preprod|prod-like")

    if manifest["decision"] not in ("go", "hold", "no-go"):
        fail("decision must be one of: go|hold|no-go")

    trace = manifest["traceability"]
    if not isinstance(trace, dict):
        fail("traceability must be an object")
    require_keys(trace, REQUIRED_TRACEABILITY_KEYS, "traceability")

    validate_github_url(trace["source_issue"], "traceability.source_issue")

    prs = trace["source_pull_requests"]
    if not isinstance(prs, list) or len(prs) == 0:
        fail("traceability.source_pull_requests must be a non-empty array")
    for idx, url in enumerate(prs):
        validate_github_url(url, f"traceability.source_pull_requests[{idx}]")

    evidence = manifest["evidence"]
    if not isinstance(evidence, dict):
        fail("evidence must be an object")
    require_keys(evidence, REQUIRED_EVIDENCE_KEYS, "evidence")

    for key, rel_path in evidence.items():
        if not isinstance(rel_path, str) or not rel_path.startswith("docs/"):
            fail(f"evidence.{key} must be a docs/ relative path")
        full = repo_root / rel_path
        if not full.exists():
            fail(f"required evidence file missing: {rel_path}")


def build_payload(manifest: Dict[str, Any], generated_at_utc: str, source_commit_sha: str) -> Dict[str, Any]:
    payload = {
        "packet_id": manifest["packet_id"],
        "generated_at_utc": generated_at_utc,
        "source_commit_sha": source_commit_sha,
        "target_environment": manifest["target_environment"],
        "decision": manifest["decision"],
        "decision_rationale": manifest.get("decision_rationale", ""),
        "traceability": manifest["traceability"],
        "evidence": manifest["evidence"],
    }
    return payload


def write_json(path: Path, payload: Dict[str, Any]):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w") as f:
        json.dump(payload, f, indent=2)
        f.write("\n")


def write_markdown(path: Path, payload: Dict[str, Any]):
    e = payload["evidence"]
    t = payload["traceability"]
    with path.open("w") as f:
        f.write("# launch-readiness packet\n\n")
        f.write(f"- packet_id: {payload['packet_id']}\n")
        f.write(f"- generated_at_utc: {payload['generated_at_utc']}\n")
        f.write(f"- source_commit_sha: `{payload['source_commit_sha']}`\n")
        f.write(f"- target_environment: {payload['target_environment']}\n")
        f.write(f"- decision: **{payload['decision']}**\n\n")

        if payload.get("decision_rationale"):
            f.write("## decision rationale\n")
            f.write(f"{payload['decision_rationale']}\n\n")

        f.write("## traceability\n")
        f.write(f"- issue: {t['source_issue']}\n")
        for i, pr in enumerate(t["source_pull_requests"], 1):
            f.write(f"- PR {i}: {pr}\n")
        f.write("\n")

        f.write("## required evidence\n")
        for k, v in e.items():
            f.write(f"- {k}: `{v}`\n")


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

    payload = build_payload(manifest, generated_at, source_sha)

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
