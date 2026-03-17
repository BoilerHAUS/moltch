# evidence-pack assembler v1

## outcome
Define and operationalize a deterministic evidence-pack assembly service for launch/review workflows.

## command
```bash
python3 scripts/ops/build_evidence_pack.py \
  --config docs/operations/evidence/assembler/evidence_pack_config_v1.json \
  --out-dir docs/operations/evidence/assembler/2026-03-17
```

## inputs
- config schema (v1):
  - `bundle_name` (string)
  - `evidence_index_doc` (docs-relative path)
  - `sources[]` (adapter entries with `type`, `id`, `url`, optional metadata)
  - `artifacts[]` (local docs artifacts with `id`, `path`, `kind`)

### source adapters (pluggable contract)
Each adapter entry must satisfy:
- `collect(context) -> evidenceArtifacts[]` contract represented by a normalized source object:
  - `type` in `issue|pr|ci-run|validator-output|logs`
  - stable `id`
  - resolvable `url`

## outputs
Generated under `--out-dir`:
- `bundle_manifest.json` (machine-readable canonical manifest)
- `bundle_checksums.json` (deterministic checksums index)
- `validation_report.json` (schema diagnostics)
- `bundle_summary.md` (human reviewer summary)

## deterministic identity
- `manifest_sha256` is computed from canonical JSON (sorted keys + compact separators) of normalized manifest core.
- `bundle_id = evp-<first16(manifest_sha256)>`
- same inputs => same `manifest_sha256` + same `bundle_id` + same checksums.

## diagnostics guarantees
Validation failures return actionable diagnostics categorized as:
- `missing_required`
- `format_invalid`
- `reference_unreachable`

Each diagnostic includes:
- failing path
- rule
- message
- remediation hint

## reproducibility fixture
- passing config: `docs/operations/evidence/assembler/evidence_pack_config_v1.json`
- intentional failing config (missing artifact): `docs/operations/evidence/assembler/evidence_pack_config_missing_artifact_v1.json`

Fail test command:
```bash
python3 scripts/ops/build_evidence_pack.py \
  --config docs/operations/evidence/assembler/evidence_pack_config_missing_artifact_v1.json \
  --out-dir docs/operations/evidence/assembler/2026-03-17-missing-artifact
```

## acceptance traceability
- one command assembles full bundle from configured inputs.
- bundle schema pass/fail with clear diagnostics.
- checksums and manifest identity are deterministic across reruns.
- output references launch evidence index via `evidence_index_doc`.
