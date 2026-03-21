#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

fail() { echo "[docs-check][fail] $1"; exit 1; }
warn() { echo "[docs-check][warn] $1"; }
pass() { echo "[docs-check][pass] $1"; }

IGNORE_FILE="docs/.docs-check-ignore"
DOCS_CHECK_ENFORCE_FRESHNESS="${DOCS_CHECK_ENFORCE_FRESHNESS:-0}"
DOCS_CHECK_FRESHNESS_DAYS="${DOCS_CHECK_FRESHNESS_DAYS:-7}"

ALLOWED_OWNER_ROLES_REGEX='^(agent_product_governance|agent_technical_delivery)$'
ALLOWED_REVIEW_CADENCE_REGEX='^(daily|weekly|biweekly|monthly|quarterly)$'
VERSION_REGEX='^v[0-9]+\.[0-9]+\.[0-9]+$'

is_ignored() {
  local f="$1"
  [[ -f "$IGNORE_FILE" ]] || return 1
  grep -Ev '^\s*#|^\s*$' "$IGNORE_FILE" | grep -Fxq "$f"
}

extract_metadata_value() {
  local key="$1" file="$2"
  grep -E "^- ${key}:[[:space:]]*" "$file" | head -n1 | sed -E "s/^- ${key}:[[:space:]]*//"
}

check_metadata_file() {
  local f="$1"
  is_ignored "$f" && { warn "$f skipped via $IGNORE_FILE"; return 0; }

  grep -Eiq '^## .*metadata' "$f" || fail "$f missing metadata block header (expected a section heading containing 'metadata')"

  local version owner_role cadence due
  version="$(grep -E '^- .*version.*:[[:space:]]*' "$f" | head -n1 | sed -E 's/^- .*version\*\*:[[:space:]]*//; s/^- .*version:[[:space:]]*//; s/\*//g')"
  owner_role="$(grep -E '^- .*owner_role.*:[[:space:]]*' "$f" | head -n1 | sed -E 's/^- .*owner_role\*\*:[[:space:]]*//; s/^- .*owner_role:[[:space:]]*//; s/\*//g')"
  cadence="$(grep -E '^- .*review_cadence.*:[[:space:]]*' "$f" | head -n1 | sed -E 's/^- .*review_cadence\*\*:[[:space:]]*//; s/^- .*review_cadence:[[:space:]]*//; s/\*//g')"
  due="$(grep -E '^- .*next_review_due.*:[[:space:]]*' "$f" | head -n1 | sed -E 's/^- .*next_review_due\*\*:[[:space:]]*//; s/^- .*next_review_due:[[:space:]]*//; s/\*//g')"

  version="$(echo "$version" | xargs)"
  owner_role="$(echo "$owner_role" | xargs)"
  cadence="$(echo "$cadence" | xargs)"
  due="$(echo "$due" | xargs)"

  [[ -n "$version" ]] || fail "$f missing metadata: version"
  [[ -n "$owner_role" ]] || fail "$f missing metadata: owner_role"
  [[ -n "$cadence" ]] || fail "$f missing metadata: review_cadence"
  [[ -n "$due" ]] || fail "$f missing metadata: next_review_due"

  [[ "$version" =~ $VERSION_REGEX ]] || fail "$f invalid version format: '$version' (expected v<major>.<minor>.<patch>)"
  [[ "$owner_role" =~ $ALLOWED_OWNER_ROLES_REGEX ]] || fail "$f invalid owner_role: '$owner_role' (allowed: agent_product_governance|agent_technical_delivery)"
  [[ "$cadence" =~ $ALLOWED_REVIEW_CADENCE_REGEX ]] || fail "$f invalid review_cadence: '$cadence' (allowed: daily|weekly|biweekly|monthly|quarterly)"
  [[ "$due" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]] || fail "$f invalid next_review_due date format: '$due' (expected YYYY-MM-DD)"

  if [[ "$DOCS_CHECK_ENFORCE_FRESHNESS" == "1" ]]; then
    local due_epoch now_epoch diff_days
    due_epoch=$(date -d "$due" +%s 2>/dev/null || true)
    now_epoch=$(date +%s)
    if [[ -z "$due_epoch" ]]; then
      fail "$f next_review_due is not a valid calendar date: $due"
    fi
    diff_days=$(( (due_epoch - now_epoch) / 86400 ))
    if (( diff_days < 0 )); then
      fail "$f next_review_due is in the past: $due"
    elif (( diff_days <= DOCS_CHECK_FRESHNESS_DAYS )); then
      warn "$f next_review_due is within ${DOCS_CHECK_FRESHNESS_DAYS} days: $due"
    fi
  fi
}

check_metadata_scope() {
  local files
  mapfile -t files < <(find docs/governance docs/product docs/operations -type f -name '*V1*.md' | sort)
  ((${#files[@]} > 0)) || fail "no governed docs found in docs/{governance,product,operations} matching *V1*.md"

  for f in "${files[@]}"; do
    check_metadata_file "$f"
  done

  pass "metadata rules validated on governed docs"
}

check_links() {
  local f target
  while IFS= read -r f; do
    # backtick-wrapped doc paths
    while IFS= read -r target; do
      [[ "$target" == docs/* ]] || continue
      [[ -f "$target" ]] || fail "$f references missing file: $target"
    done < <(grep -oE '`docs/[^`]+\.md`' "$f" | sed -E 's/`//g' || true)

    # markdown links with docs/ path
    while IFS= read -r target; do
      target="${target%%#*}"
      [[ "$target" == docs/* ]] || continue
      [[ -f "$target" ]] || fail "$f markdown link points to missing file: $target"
    done < <(grep -oE '\]\((docs/[^)#]+\.md([#?][^)]*)?)\)' "$f" | sed -E 's/^\]\((docs\/[^)]*)\)$/\1/' || true)
  done < <(find docs -type f -name '*.md' | sort)

  pass "cross-link integrity checks passed"
}

check_docs_index_coverage() {
  local index="docs/README.md"
  [[ -f "$index" ]] || fail "$index missing"

  declare -A indexed
  while IFS= read -r docpath; do
    indexed["$docpath"]=1
  done < <(grep -oE '`docs/[^`]+\.md`' "$index" | sed -E 's/`//g' | sort -u)

  local missing=()
  while IFS= read -r f; do
    [[ "$f" == "docs/README.md" ]] && continue
    if [[ -z "${indexed[$f]:-}" ]]; then
      missing+=("$f")
    fi
  done < <(find docs -type f -name '*.md' | sort)

  if (( ${#missing[@]} > 0 )); then
    fail "docs index coverage gaps in docs/README.md: ${missing[*]}"
  fi

  pass "docs index coverage ok"
}

check_launch_gate_evidence_schema() {
  local schema="docs/operations/schemas/LAUNCH_GATE_EVIDENCE_PACKAGE_V1.schema.json"
  local validator="scripts/ops/validate_launch_gate_evidence.py"
  local sample="docs/operations/evidence/launch_gate_evidence_package_valid_v1.json"
  local sample_edge="docs/operations/evidence/launch_gate_evidence_package_valid_edge_v1.json"
  local invalid_missing_required="docs/operations/evidence/launch_gate_evidence_package_invalid_missing_required_v1.json"
  local invalid_enum="docs/operations/evidence/launch_gate_evidence_package_invalid_enum_v1.json"
  local invalid_root="docs/operations/evidence/launch_gate_evidence_package_invalid_extra_root_v1.json"
  local invalid_nested="docs/operations/evidence/launch_gate_evidence_package_invalid_extra_nested_v1.json"
  local invalid_runtime_nested="docs/operations/evidence/launch_gate_evidence_package_invalid_extra_runtime_nested_v1.json"
  local invalid_format="docs/operations/evidence/launch_gate_evidence_package_invalid_format_v1.json"
  local invalid_pattern="docs/operations/evidence/launch_gate_evidence_package_invalid_pattern_v1.json"
  local invalid_composition="docs/operations/evidence/launch_gate_evidence_package_invalid_composition_v1.json"

  [[ -f "$schema" ]] || fail "$schema missing"
  [[ -f "$validator" ]] || fail "$validator missing"
  [[ -f "$sample" ]] || fail "$sample missing"
  [[ -f "$sample_edge" ]] || fail "$sample_edge missing"
  [[ -f "$invalid_missing_required" ]] || fail "$invalid_missing_required missing"
  [[ -f "$invalid_enum" ]] || fail "$invalid_enum missing"
  [[ -f "$invalid_root" ]] || fail "$invalid_root missing"
  [[ -f "$invalid_nested" ]] || fail "$invalid_nested missing"
  [[ -f "$invalid_runtime_nested" ]] || fail "$invalid_runtime_nested missing"
  [[ -f "$invalid_format" ]] || fail "$invalid_format missing"
  [[ -f "$invalid_pattern" ]] || fail "$invalid_pattern missing"
  [[ -f "$invalid_composition" ]] || fail "$invalid_composition missing"

  python3 "$validator" --schema "$schema" --input "$sample" --input "$sample_edge" >/dev/null

  if python3 "$validator" --schema "$schema" --input "$invalid_missing_required" >/dev/null 2>&1; then
    fail "invalid missing-required fixture unexpectedly passed"
  fi

  if python3 "$validator" --schema "$schema" --input "$invalid_enum" >/dev/null 2>&1; then
    fail "invalid enum fixture unexpectedly passed"
  fi

  if python3 "$validator" --schema "$schema" --input "$invalid_root" >/dev/null 2>&1; then
    fail "invalid root additional property fixture unexpectedly passed"
  fi

  if python3 "$validator" --schema "$schema" --input "$invalid_nested" >/dev/null 2>&1; then
    fail "invalid nested additional property fixture unexpectedly passed"
  fi

  if python3 "$validator" --schema "$schema" --input "$invalid_runtime_nested" >/dev/null 2>&1; then
    fail "invalid runtime nested additional property fixture unexpectedly passed"
  fi

  if python3 "$validator" --schema "$schema" --input "$invalid_format" >/dev/null 2>&1; then
    fail "invalid format fixture unexpectedly passed"
  fi

  if python3 "$validator" --schema "$schema" --input "$invalid_pattern" >/dev/null 2>&1; then
    fail "invalid pattern fixture unexpectedly passed"
  fi

  if python3 "$validator" --schema "$schema" --input "$invalid_composition" >/dev/null 2>&1; then
    fail "invalid composition fixture unexpectedly passed"
  fi

  pass "launch-gate evidence schema validation passed"
}

check_launch_readiness_packet_builder() {
  local builder="scripts/ops/build_launch_readiness_packet.py"
  local manifest="docs/operations/evidence/launch-readiness/launch_readiness_packet_manifest_v1.json"
  local out_dir="docs/operations/evidence/launch-readiness/2026-03-14-dry-run"
  local hold_manifest="docs/operations/evidence/launch-readiness/launch_readiness_packet_manifest_hold_v1.json"
  local invalid_manifest="docs/operations/evidence/launch-readiness/launch_readiness_packet_manifest_invalid_v1.json"
  local fixed_sha="deterministic-sha-v1"

  [[ -f "$builder" ]] || fail "$builder missing"
  [[ -f "$manifest" ]] || fail "$manifest missing"
  [[ -f "$hold_manifest" ]] || fail "$hold_manifest missing"
  [[ -f "$invalid_manifest" ]] || fail "$invalid_manifest missing"

  python3 "$builder" \
    --manifest "$manifest" \
    --out-dir "$out_dir" \
    --source-commit-sha "$fixed_sha" >/dev/null

  [[ -f "$out_dir/launch_readiness_packet.json" ]] || fail "launch readiness packet json missing after build"
  [[ -f "$out_dir/launch_readiness_packet.md" ]] || fail "launch readiness packet markdown missing after build"

  local computed_decision
  computed_decision=$(python3 -c 'import json;print(json.load(open("docs/operations/evidence/launch-readiness/2026-03-14-dry-run/launch_readiness_packet.json"))["decision"])')
  [[ "$computed_decision" == "go" ]] || fail "expected computed go decision for baseline manifest, got: $computed_decision"

  mkdir -p .tmp
  local hold_dir
  hold_dir=$(mktemp -d .tmp/launch-packet-hold.XXXXXX)
  python3 "$builder" --manifest "$hold_manifest" --out-dir "$hold_dir" --source-commit-sha "$fixed_sha" >/dev/null
  computed_decision=$(python3 -c "import json;print(json.load(open('$hold_dir/launch_readiness_packet.json'))['decision'])")
  [[ "$computed_decision" == "hold" ]] || fail "expected computed hold decision for stale manifest, got: $computed_decision"
  rm -rf "$hold_dir"

  if python3 "$builder" --manifest "$invalid_manifest" --out-dir "$out_dir" >/dev/null 2>&1; then
    fail "invalid manifest unexpectedly passed launch-readiness packet build"
  fi

  pass "launch-readiness packet assembly passed"
}

check_review_ops_scoreboard_generator() {
  local generator="scripts/ops/generate_review_ops_scoreboard.py"
  local input="docs/operations/evidence/review-ops/2026-W11/review_ops_input.sample.json"
  local invalid_input="docs/operations/evidence/review-ops/2026-W11/review_ops_input.invalid.json"
  local out="docs/operations/evidence/review-ops/2026-W11/review_ops_scoreboard.md"

  [[ -f "$generator" ]] || fail "$generator missing"
  [[ -f "$input" ]] || fail "$input missing"
  [[ -f "$invalid_input" ]] || fail "$invalid_input missing"

  python3 "$generator" --source-json "$input" --out "$out" >/dev/null
  [[ -f "$out" ]] || fail "$out missing after scoreboard generation"

  if python3 "$generator" --source-json "$invalid_input" --out "$out" >/dev/null 2>&1; then
    fail "invalid review-ops input unexpectedly passed scoreboard generator"
  fi

  pass "review-ops scoreboard generation validation passed"
}


check_decision_alert_threshold_profile() {
  local validator="scripts/ops/validate_decision_alert_threshold_profile.py"
  local profile="docs/operations/evidence/decision-observability/2026-03-21/decision_alert_threshold_profile_v1.json"

  [[ -f "$validator" ]] || fail "$validator missing"
  [[ -f "$profile" ]] || fail "$profile missing"

  python3 "$validator" --input "$profile" >/dev/null

  pass "decision alert threshold profile validation passed"
}

check_policy_decision_conformance() {
  local runner="scripts/ops/run_policy_decision_conformance.py"
  local fixtures="docs/governance/fixtures/policy_decision_conformance_cases_v1.json"
  local invalid_fixtures="docs/governance/fixtures/policy_decision_conformance_cases_invalid_v1.json"
  local catalog="docs/governance/POLICY_DECISION_REASON_CODE_CATALOG_V1_2.md"
  local out_json="docs/governance/evidence/policy_decision_conformance_summary_2026-03-14.json"
  local out_md="docs/governance/evidence/POLICY_DECISION_CONFORMANCE_SUMMARY_2026-03-14.md"

  [[ -f "$runner" ]] || fail "$runner missing"
  [[ -f "$fixtures" ]] || fail "$fixtures missing"
  [[ -f "$invalid_fixtures" ]] || fail "$invalid_fixtures missing"
  [[ -f "$catalog" ]] || fail "$catalog missing"

  python3 "$runner" --fixtures "$fixtures" --catalog "$catalog" --out-json "$out_json" --out-md "$out_md" --generated-at-utc "2026-03-14T00:00:00Z" >/dev/null
  [[ -f "$out_json" ]] || fail "$out_json missing after conformance run"
  [[ -f "$out_md" ]] || fail "$out_md missing after conformance run"

  if python3 "$runner" --fixtures "$invalid_fixtures" --catalog "$catalog" --out-json /tmp/policy_conformance_invalid.json --out-md /tmp/policy_conformance_invalid.md --generated-at-utc "2026-03-14T00:00:00Z" >/dev/null 2>&1; then
    fail "invalid policy conformance fixture unexpectedly passed"
  fi

  pass "policy decision conformance validation passed"
}

check_pr_template_contract() {
  local template=".github/pull_request_template.md"
  [[ -f "$template" ]] || fail "$template missing"

  grep -Fq 'Closes #' "$template" || fail "$template missing linked issue requirement"
  grep -Fq 'Issue classification state:' "$template" || fail "$template missing issue classification state field"
  grep -Fq 'PR-lane admission status / readiness basis:' "$template" || fail "$template missing PR-lane admission field"
  grep -Fq '## Pre-merge follow-through' "$template" || fail "$template missing pre-merge follow-through section"
  grep -Fq 'CI status / link to latest green run:' "$template" || fail "$template missing CI follow-through field"
  grep -Fq 'Conflict remediation performed (or `none required`):' "$template" || fail "$template missing conflict remediation field"
  grep -Fq '## Post-merge reconciliation plan' "$template" || fail "$template missing post-merge reconciliation section"
  grep -Fq 'Linked issue close path:' "$template" || fail "$template missing linked issue close path field"
  grep -Fq 'Branch cleanup / final reconciliation notes:' "$template" || fail "$template missing branch cleanup reconciliation field"
  grep -Fq 'CI failures will be remediated on this PR unless proven external' "$template" || fail "$template missing CI remediation checklist item"
  grep -Fq 'Merge conflicts/stale branch state will be remediated on this PR before handoff' "$template" || fail "$template missing conflict remediation checklist item"
  grep -Fq 'Post-merge reconciliation plan captured above (or explicitly `n/a`)' "$template" || fail "$template missing post-merge reconciliation checklist item"

  pass "PR template delivery contract checks passed"
}

check_context_boundary_handoff_validator() {
  local validator="scripts/ops/validate_context_boundary_handoff.py"
  local valid="scripts/ops/fixtures/context_boundary/handoff_valid_v1.json"
  local invalid_crossing="scripts/ops/fixtures/context_boundary/handoff_invalid_denied_crossing_v1.json"
  local invalid_promotion="scripts/ops/fixtures/context_boundary/handoff_invalid_promotion_v1.json"

  [[ -f "$validator" ]] || fail "$validator missing"
  [[ -f "$valid" ]] || fail "$valid missing"
  [[ -f "$invalid_crossing" ]] || fail "$invalid_crossing missing"
  [[ -f "$invalid_promotion" ]] || fail "$invalid_promotion missing"

  python3 "$validator" --input "$valid" >/dev/null

  if python3 "$validator" --input "$invalid_crossing" >/dev/null 2>&1; then
    fail "invalid context-boundary denied-crossing fixture unexpectedly passed"
  fi

  if python3 "$validator" --input "$invalid_promotion" >/dev/null 2>&1; then
    fail "invalid context-boundary promotion fixture unexpectedly passed"
  fi

  pass "context boundary handoff validator fixtures passed"
}

check_issue_classification_validator() {
  local validator="scripts/ops/validate_issue_classification.py"
  local roadmap="scripts/ops/fixtures/issue_classification/ROADMAP_V1.fixture.md"
  local valid="scripts/ops/fixtures/issue_classification/issue_classification_status_valid_v1.json"
  local invalid_pr="scripts/ops/fixtures/issue_classification/issue_classification_status_invalid_pr_existence_v1.json"
  local invalid_auto="scripts/ops/fixtures/issue_classification/issue_classification_status_invalid_auto_active_v1.json"

  [[ -f "$validator" ]] || fail "$validator missing"
  [[ -f "$roadmap" ]] || fail "$roadmap missing"
  [[ -f "$valid" ]] || fail "$valid missing"
  [[ -f "$invalid_pr" ]] || fail "$invalid_pr missing"
  [[ -f "$invalid_auto" ]] || fail "$invalid_auto missing"

  python3 "$validator" --roadmap "$roadmap" --input "$valid" >/dev/null

  if python3 "$validator" --roadmap "$roadmap" --input "$invalid_pr" >/dev/null 2>&1; then
    fail "invalid issue-classification PR-existence fixture unexpectedly passed"
  fi

  if python3 "$validator" --roadmap "$roadmap" --input "$invalid_auto" >/dev/null 2>&1; then
    fail "invalid issue-classification auto-active fixture unexpectedly passed"
  fi

  pass "issue classification validator fixtures passed"
}

check_roadmap_issue_mapping() {
  local roadmap="docs/product/ROADMAP_V1.md"
  local reconciler="scripts/ops/reconcile_roadmap_open_issues.py"
  [[ -f "$roadmap" ]] || fail "$roadmap missing"
  [[ -f "$reconciler" ]] || fail "$reconciler missing"

  if ! command -v gh >/dev/null 2>&1; then
    warn "gh CLI not installed; skipping roadmap issue mapping check"
    return 0
  fi

  local repo="${GITHUB_REPOSITORY:-BoilerHAUS/moltch}"
  if [[ -z "${GH_TOKEN:-}" && -z "${GITHUB_TOKEN:-}" ]]; then
    warn "GH_TOKEN/GITHUB_TOKEN not set; skipping roadmap issue mapping check"
    return 0
  fi
  export GH_TOKEN="${GH_TOKEN:-${GITHUB_TOKEN:-}}"

  local artifact_dir
  artifact_dir="$(mktemp -d)"
  if ! python3 "$reconciler" \
    --repo "$repo" \
    --roadmap "$roadmap" \
    --trigger-mode pre-merge \
    --artifact-dir "$artifact_dir" \
    --check >/dev/null; then
    rm -rf "$artifact_dir"
    fail "roadmap open-issue reconciliation drift detected (run $reconciler for immutable artifact details)"
  fi
  rm -rf "$artifact_dir"

  pass "roadmap mapping coverage and reconciliation classification ok"
}

check_metadata_scope
check_links
check_docs_index_coverage
check_pr_template_contract
check_issue_classification_validator
check_context_boundary_handoff_validator
check_launch_gate_evidence_schema
check_launch_readiness_packet_builder
check_review_ops_scoreboard_generator
check_decision_alert_threshold_profile
check_policy_decision_conformance
check_roadmap_issue_mapping

pass "metadata, links, index coverage, PR template delivery contract, issue classification validator, context boundary handoff validator, evidence schema, launch-readiness packet, review-ops scoreboard, decision alert threshold profile, policy conformance, and roadmap mapping checks passed"
