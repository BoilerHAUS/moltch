#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

fail() { echo "[docs-check][fail] $1"; exit 1; }
warn() { echo "[docs-check][warn] $1"; }

IGNORE_FILE="docs/.docs-check-ignore"
DOCS_CHECK_ENFORCE_FRESHNESS="${DOCS_CHECK_ENFORCE_FRESHNESS:-0}"
DOCS_CHECK_FRESHNESS_DAYS="${DOCS_CHECK_FRESHNESS_DAYS:-7}"

is_ignored() {
  local f="$1"
  [[ -f "$IGNORE_FILE" ]] || return 1
  grep -Ev '^\s*#|^\s*$' "$IGNORE_FILE" | grep -Fxq "$f"
}

check_metadata_file() {
  local f="$1"
  is_ignored "$f" && { warn "$f skipped via $IGNORE_FILE"; return 0; }
  grep -Eq '(^## metadata|^\*\*metadata\*\*)' "$f" || { warn "$f has no metadata block; skipping metadata enforcement"; return 0; }
  grep -Eq '(^- version:|\*\*version:\*\*)' "$f" || fail "$f missing metadata: version"
  grep -Eq '(^- owner_role:|\*\*owner_role:\*\*|\*\*owner:\*\*)' "$f" || fail "$f missing metadata: owner_role/owner"
  grep -Eq '(^- review_cadence:|\*\*review_cadence:\*\*|\*\*review cadence:\*\*)' "$f" || fail "$f missing metadata: review_cadence"
  grep -Eq '(^- next_review_due:|\*\*next_review_due:\*\*|\*\*next review due:\*\*)' "$f" || fail "$f missing metadata: next_review_due"

  local d
  d=$(grep -E '(^- next_review_due:|^- \*\*next_review_due:\*\*|^- \*\*next review due:\*\*|\*\*next_review_due:\*\*|\*\*next review due:\*\*)' "$f" | head -n1 | sed -E 's/^- next_review_due:[[:space:]]*//; s/^- \*\*next_review_due:\*\*[[:space:]]*//; s/^- \*\*next review due:\*\*[[:space:]]*//; s/^\*\*next_review_due:\*\*[[:space:]]*//; s/^\*\*next review due:\*\*[[:space:]]*//')
  [[ "$d" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]] || fail "$f invalid next_review_due date format: $d"

  if [[ "$DOCS_CHECK_ENFORCE_FRESHNESS" == "1" ]]; then
    local due_epoch now_epoch diff_days
    due_epoch=$(date -d "$d" +%s 2>/dev/null || true)
    now_epoch=$(date +%s)
    if [[ -n "$due_epoch" ]]; then
      diff_days=$(( (due_epoch - now_epoch) / 86400 ))
      if (( diff_days < 0 )); then
        fail "$f next_review_due is in the past: $d"
      elif (( diff_days <= DOCS_CHECK_FRESHNESS_DAYS )); then
        warn "$f next_review_due is within ${DOCS_CHECK_FRESHNESS_DAYS} days: $d"
      fi
    fi
  fi
}

while IFS= read -r f; do
  check_metadata_file "$f"
done < <(find docs/governance docs/product docs/operations -type f -name '*_V1*.md' | sort)

while IFS= read -r f; do
  while IFS= read -r link; do
    target=$(echo "$link" | sed -E 's/.*`([^`]+)`/\1/')
    [[ "$target" == docs/* ]] || continue
    [[ -f "$target" ]] || fail "$f references missing file: $target"
  done < <(grep -oE '`docs/[^`]+\.md`' "$f" || true)
done < <(find docs -type f -name '*.md' | sort)

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

  local missing=()
  local n
  for n in "${open_issue_nums[@]}"; do
    if [[ -z "${mapped[$n]:-}" && -z "${excluded[$n]:-}" ]]; then
      missing+=("#$n")
    fi
  done

  if (( ${#missing[@]} > 0 )); then
    fail "open issues missing roadmap mapping/exclusion: ${missing[*]}"
  fi

  echo "[docs-check][pass] roadmap mapping coverage ok (${#open_issue_nums[@]} open issues)"
}

check_roadmap_issue_mapping

echo "[docs-check][pass] metadata, links, and roadmap mapping checks passed"