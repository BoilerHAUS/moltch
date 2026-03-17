#!/usr/bin/env python3
import argparse
import hashlib
import json
import re
import subprocess
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

SCRIPT_VERSION = "v1.0.0"
SOURCE_TYPES = {"issue", "pr", "ci-run", "validator-output", "logs"}
URL_RE = re.compile(r"^https://[^\s]+$")
DOCS_REL_RE = re.compile(r"^docs/[A-Za-z0-9._\-/]+$")


@dataclass
class ValidationErrorEntry:
    category: str
    path: str
    rule: str
    message: str
    hint: str


def fail(msg: str) -> None:
    print(f"[evidence-pack][fail] {msg}", file=sys.stderr)
    sys.exit(1)


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def git_head_sha() -> str:
    try:
        return subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip()
    except Exception:
        return "unknown"


def read_json(path: Path) -> Dict[str, Any]:
    with path.open() as f:
        return json.load(f)


def write_json(path: Path, payload: Dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w") as f:
        json.dump(payload, f, indent=2, sort_keys=True)
        f.write("\n")


def sha256_bytes(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        while True:
            chunk = f.read(8192)
            if not chunk:
                break
            h.update(chunk)
    return h.hexdigest()


def canonical_json_bytes(payload: Dict[str, Any]) -> bytes:
    return json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")


def normalize_docs_path(repo_root: Path, rel: str) -> Optional[Path]:
    if not isinstance(rel, str) or not DOCS_REL_RE.match(rel):
        return None
    path = (repo_root / rel).resolve()
    try:
        path.relative_to(repo_root)
    except Exception:
        return None
    if ".." in Path(rel).parts:
        return None
    return path


def add_error(errors: List[ValidationErrorEntry], category: str, path: str, rule: str, message: str, hint: str) -> None:
    errors.append(ValidationErrorEntry(category=category, path=path, rule=rule, message=message, hint=hint))


def validate_config(config: Dict[str, Any], repo_root: Path) -> List[ValidationErrorEntry]:
    errors: List[ValidationErrorEntry] = []

    required_root = {"bundle_name", "evidence_index_doc", "sources", "artifacts"}
    for key in required_root:
        if key not in config:
            add_error(errors, "missing_required", f"$.{key}", "required", f"Missing required field: {key}", f"Add `{key}` to root config.")

    if not isinstance(config.get("bundle_name"), str) or not config.get("bundle_name", "").strip():
        add_error(errors, "format_invalid", "$.bundle_name", "non_empty_string", "bundle_name must be a non-empty string", "Set bundle_name to a human-readable identifier.")

    idx = config.get("evidence_index_doc")
    idx_path = normalize_docs_path(repo_root, idx) if isinstance(idx, str) else None
    if idx_path is None:
        add_error(errors, "format_invalid", "$.evidence_index_doc", "docs_relative_path", "evidence_index_doc must be normalized docs/ relative path", "Use a docs path like docs/operations/evidence/LAUNCH_EVIDENCE_INDEX_2026-03.md.")
    elif not idx_path.exists():
        add_error(errors, "reference_unreachable", "$.evidence_index_doc", "exists", f"Referenced docs path does not exist: {idx}", "Create the index doc or update the path.")

    sources = config.get("sources")
    if not isinstance(sources, list) or len(sources) == 0:
        add_error(errors, "missing_required", "$.sources", "non_empty_array", "sources must be a non-empty array", "Add at least one source adapter entry.")
    else:
        seen_ids = set()
        for i, source in enumerate(sources):
            p = f"$.sources[{i}]"
            if not isinstance(source, dict):
                add_error(errors, "format_invalid", p, "object", "source entry must be an object", "Provide source as object with type/id/url.")
                continue
            src_type = source.get("type")
            src_id = source.get("id")
            src_url = source.get("url")

            if src_type not in SOURCE_TYPES:
                add_error(errors, "format_invalid", f"{p}.type", "enum", f"unsupported source type: {src_type}", f"Use one of: {', '.join(sorted(SOURCE_TYPES))}.")
            if not isinstance(src_id, str) or not src_id.strip():
                add_error(errors, "missing_required", f"{p}.id", "non_empty_string", "source.id is required", "Set a stable source id (e.g., issue-165).")
            elif src_id in seen_ids:
                add_error(errors, "format_invalid", f"{p}.id", "unique", f"duplicate source id: {src_id}", "Use unique IDs for deterministic manifests.")
            else:
                seen_ids.add(src_id)

            if not isinstance(src_url, str) or not URL_RE.match(src_url):
                add_error(errors, "format_invalid", f"{p}.url", "https_url", "source.url must be an https URL", "Use a direct GitHub (or equivalent) HTTPS artifact URL.")

    artifacts = config.get("artifacts")
    if not isinstance(artifacts, list) or len(artifacts) == 0:
        add_error(errors, "missing_required", "$.artifacts", "non_empty_array", "artifacts must be a non-empty array", "Add artifact entries that map to local files.")
    else:
        seen_artifact_ids = set()
        for i, artifact in enumerate(artifacts):
            p = f"$.artifacts[{i}]"
            if not isinstance(artifact, dict):
                add_error(errors, "format_invalid", p, "object", "artifact entry must be an object", "Provide artifact as object with id/path/kind.")
                continue

            aid = artifact.get("id")
            apath = artifact.get("path")
            akind = artifact.get("kind")

            if not isinstance(aid, str) or not aid.strip():
                add_error(errors, "missing_required", f"{p}.id", "non_empty_string", "artifact.id is required", "Set a stable artifact id.")
            elif aid in seen_artifact_ids:
                add_error(errors, "format_invalid", f"{p}.id", "unique", f"duplicate artifact id: {aid}", "Use unique artifact IDs.")
            else:
                seen_artifact_ids.add(aid)

            if akind not in {"json", "markdown", "log", "text", "other"}:
                add_error(errors, "format_invalid", f"{p}.kind", "enum", f"unsupported artifact kind: {akind}", "Use kind in [json, markdown, log, text, other].")

            npath = normalize_docs_path(repo_root, apath) if isinstance(apath, str) else None
            if npath is None:
                add_error(errors, "format_invalid", f"{p}.path", "docs_relative_path", "artifact.path must be normalized docs/ relative path", "Use a docs relative file path.")
            elif not npath.exists():
                add_error(errors, "reference_unreachable", f"{p}.path", "exists", f"artifact file missing: {apath}", "Generate artifact first or fix path.")

    return errors


def build_source_records(sources: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    records = []
    for source in sorted(sources, key=lambda x: x["id"]):
        records.append(
            {
                "id": source["id"],
                "type": source["type"],
                "url": source["url"],
                "title": source.get("title", ""),
                "notes": source.get("notes", ""),
            }
        )
    return records


def build_artifact_records(repo_root: Path, artifacts: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], Dict[str, str]]:
    records = []
    checksums: Dict[str, str] = {}
    for artifact in sorted(artifacts, key=lambda x: x["id"]):
        path = normalize_docs_path(repo_root, artifact["path"])
        if path is None:
            continue
        digest = sha256_file(path)
        checksums[artifact["id"]] = digest
        records.append(
            {
                "id": artifact["id"],
                "kind": artifact["kind"],
                "path": artifact["path"],
                "sha256": digest,
            }
        )
    return records, checksums


def build_validation_report(errors: List[ValidationErrorEntry], config_path: Path) -> Dict[str, Any]:
    return {
        "config_path": str(config_path),
        "status": "fail" if errors else "pass",
        "errors": [
            {
                "category": e.category,
                "path": e.path,
                "rule": e.rule,
                "message": e.message,
                "hint": e.hint,
            }
            for e in errors
        ],
    }


def write_summary_md(path: Path, bundle_manifest: Dict[str, Any], validation_report: Dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w") as f:
        f.write("# evidence pack summary\n\n")
        f.write(f"- bundle_id: `{bundle_manifest['bundle_id']}`\n")
        f.write(f"- bundle_name: {bundle_manifest['bundle_name']}\n")
        f.write(f"- generated_at_utc: {bundle_manifest['generated_at_utc']}\n")
        f.write(f"- source_commit_sha: `{bundle_manifest['source_commit_sha']}`\n")
        f.write(f"- schema_validation_status: **{validation_report['status']}**\n")
        f.write(f"- launch_evidence_index: `{bundle_manifest['evidence_index_doc']}`\n\n")

        f.write("## included sources\n")
        for source in bundle_manifest["sources"]:
            f.write(f"- [{source['type']}] {source['id']}: {source['url']}\n")
        f.write("\n")

        f.write("## included artifacts\n")
        for artifact in bundle_manifest["artifacts"]:
            f.write(f"- {artifact['id']} ({artifact['kind']}): `{artifact['path']}` sha256=`{artifact['sha256']}`\n")
        f.write("\n")

        if validation_report["status"] == "fail":
            f.write("## validation diagnostics\n")
            for err in validation_report["errors"]:
                f.write(
                    f"- [{err['category']}] {err['path']} ({err['rule']}): {err['message']}\n"
                    f"  - remediation: {err['hint']}\n"
                )
        else:
            f.write("## validation diagnostics\n- none (all checks passed)\n")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", required=True, help="Path to evidence pack config JSON (repo-relative)")
    parser.add_argument("--out-dir", required=True, help="Output directory for generated evidence bundle (repo-relative)")
    parser.add_argument("--generated-at-utc", help="Override generated timestamp")
    parser.add_argument("--source-commit-sha", help="Override source commit SHA")
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parents[2]
    config_path = (repo_root / args.config).resolve()
    if not config_path.exists():
        fail(f"config not found: {args.config}")

    out_dir = (repo_root / args.out_dir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    try:
        config = read_json(config_path)
    except Exception as e:
        fail(f"unable to parse config JSON: {e}")

    errors = validate_config(config, repo_root)
    validation_report = build_validation_report(errors, config_path)

    validation_path = out_dir / "validation_report.json"
    write_json(validation_path, validation_report)

    if errors:
        for err in errors:
            print(
                f"[evidence-pack][diagnostic] category={err.category} path={err.path} rule={err.rule} message={err.message} hint={err.hint}",
                file=sys.stderr,
            )
        print(f"[evidence-pack][fail] schema validation failed. report: {validation_path.relative_to(repo_root)}", file=sys.stderr)
        sys.exit(1)

    generated_at = args.generated_at_utc or utc_now_iso()
    source_sha = args.source_commit_sha or git_head_sha()

    source_records = build_source_records(config["sources"])
    artifact_records, checksums = build_artifact_records(repo_root, config["artifacts"])

    manifest_core = {
        "bundle_name": config["bundle_name"],
        "evidence_index_doc": config["evidence_index_doc"],
        "sources": source_records,
        "artifacts": artifact_records,
    }

    manifest_digest = sha256_bytes(canonical_json_bytes(manifest_core))
    bundle_id = f"evp-{manifest_digest[:16]}"

    bundle_manifest = {
        "bundle_id": bundle_id,
        "bundle_name": config["bundle_name"],
        "generated_at_utc": generated_at,
        "source_commit_sha": source_sha,
        "manifest_sha256": manifest_digest,
        "script": "scripts/ops/build_evidence_pack.py",
        "script_version": SCRIPT_VERSION,
        "evidence_index_doc": config["evidence_index_doc"],
        "sources": source_records,
        "artifacts": artifact_records,
    }

    checksums_payload = {
        "bundle_id": bundle_id,
        "manifest_sha256": manifest_digest,
        "checksums": dict(sorted(checksums.items(), key=lambda x: x[0])),
    }

    manifest_path = out_dir / "bundle_manifest.json"
    checksums_path = out_dir / "bundle_checksums.json"
    summary_path = out_dir / "bundle_summary.md"

    write_json(manifest_path, bundle_manifest)
    write_json(checksums_path, checksums_payload)
    write_summary_md(summary_path, bundle_manifest, validation_report)

    print(f"[evidence-pack][pass] wrote {manifest_path.relative_to(repo_root)}")
    print(f"[evidence-pack][pass] wrote {checksums_path.relative_to(repo_root)}")
    print(f"[evidence-pack][pass] wrote {validation_path.relative_to(repo_root)}")
    print(f"[evidence-pack][pass] wrote {summary_path.relative_to(repo_root)}")


if __name__ == "__main__":
    main()
