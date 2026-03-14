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

  [[ -f "$schema" ]] || fail "$schema missing"
  [[ -f "$validator" ]] || fail "$validator missing"
  [[ -f "$sample" ]] || fail "$sample missing"

  python3 "$validator" \
    --schema "$schema" \
    --input "$sample" >/dev/null

  pass "launch-gate evidence schema validation passed"
}

check_launch_readiness_packet_builder() {
  local builder="scripts/ops/build_launch_readiness_packet.py"
  local manifest="docs/operations/evidence/launch-readiness/launch_readiness_packet_manifest_v1.json"
  local out_dir="docs/operations/evidence/launch-readiness/2026-03-14-dry-run"
  local invalid_manifest="docs/operations/evidence/launch-readiness/launch_readiness_packet_manifest_invalid_v1.json"

  [[ -f "$builder" ]] || fail "$builder missing"
  [[ -f "$manifest" ]] || fail "$manifest missing"
  [[ -f "$invalid_manifest" ]] || fail "$invalid_manifest missing"

  python3 "$builder" \
    --manifest "$manifest" \
    --out-dir "$out_dir" >/dev/null

  [[ -f "$out_dir/launch_readiness_packet.json" ]] || fail "launch readiness packet json missing after build"
  [[ -f "$out_dir/launch_readiness_packet.md" ]] || fail "launch readiness packet markdown missing after build"

  if python3 "$builder" --manifest "$invalid_manifest" --out-dir "$out_dir" >/dev/null 2>&1; then
    fail "invalid manifest unexpectedly passed launch-readiness packet build"
  fi

  pass "launch-readiness packet assembly passed"
}

check_roadmap_issue_mapping() {
  local roadmap="docs/product/ROADMAP_V1.md"
  [[ -f "$roadmap" ]] || fail "$roadmap missing"

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

  mapfile -t open_issue_nums < <(gh api --paginate -X GET "repos/${repo}/issues?state=open&per_page=100" --jq '.[] | select(.pull_request == null) | .number')

  declare -A mapped excluded
  while IFS= read -r n; do mapped["$n"]=1; done < <(sed -nE 's/^\|[[:space:]]*#([0-9]+)[[:space:]]*\|.*/\1/p' "$roadmap")
  while IFS= read -r n; do excluded["$n"]=1; done < <(awk '
    BEGIN {in_ex=0}
    /^## excluded issues/ {in_ex=1; next}
    /^## / && in_ex==1 {in_ex=0}
    in_ex==1 {print}
  ' "$roadmap" | grep -oE '#[0-9]+' | tr -d '#' | sort -u)

  local missing=() n
  for n in "${open_issue_nums[@]}"; do
    if [[ -z "${mapped[$n]:-}" && -z "${excluded[$n]:-}" ]]; then
      missing+=("#$n")
    fi
  done

  if (( ${#missing[@]} > 0 )); then
    fail "open issues missing roadmap mapping/exclusion: ${missing[*]}"
  fi

  pass "roadmap mapping coverage ok (${#open_issue_nums[@]} open issues)"
}

check_metadata_scope
check_links
check_docs_index_coverage
check_launch_gate_evidence_schema
check_launch_readiness_packet_builder
check_roadmap_issue_mapping

pass "metadata, links, index coverage, evidence schema, launch-readiness packet, and roadmap mapping checks passed"
