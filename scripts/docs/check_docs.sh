#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

fail() { echo "[docs-check][fail] $1"; exit 1; }
warn() { echo "[docs-check][warn] $1"; }

IGNORE_FILE="docs/.docs-check-ignore"
DOCS_CHECK_ENFORCE_FRESHNESS="${DOCS_CHECK_ENFORCE_FRESHNESS:-0}"
DOCS_CHECK_FRESHNESS_DAYS="${DOCS_CHECK_FRESHNESS_DAYS:-7}"

# Required metadata by doc class
is_ignored() {
  local f="$1"
  [[ -f "$IGNORE_FILE" ]] || return 1
  grep -Ev '^\s*#|^\s*$' "$IGNORE_FILE" | grep -Fxq "$f"
}

check_metadata_file() {
  local f="$1"
  is_ignored "$f" && { warn "$f skipped via $IGNORE_FILE"; return 0; }
  grep -Eq '(^- version:|\*\*version:\*\*)' "$f" || fail "$f missing metadata: version"
  grep -Eq '(^- owner_role:|\*\*owner_role:\*\*|\*\*owner:\*\*)' "$f" || fail "$f missing metadata: owner_role/owner"
  grep -Eq '(^- review_cadence:|\*\*review_cadence:\*\*|\*\*review cadence:\*\*)' "$f" || fail "$f missing metadata: review_cadence"
  grep -Eq '(^- next_review_due:|\*\*next_review_due:\*\*|\*\*next review due:\*\*)' "$f" || fail "$f missing metadata: next_review_due"
  # date format YYYY-MM-DD
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

# Check metadata on governance/product/operations docs
while IFS= read -r f; do
  check_metadata_file "$f"
done < <(find docs/governance docs/product docs/operations -type f -name '*.md' | sort)

# Internal markdown link checker: only backtick-wrapped relative .md paths for now
while IFS= read -r f; do
  while IFS= read -r link; do
    target=$(echo "$link" | sed -E 's/.*`([^`]+)`/\1/')
    [[ "$target" == docs/* ]] || continue
    [[ -f "$target" ]] || fail "$f references missing file: $target"
  done < <(grep -oE '`docs/[^`]+\.md`' "$f" || true)
done < <(find docs -type f -name '*.md' | sort)

echo "[docs-check][pass] metadata and link checks passed"