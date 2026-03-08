#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

fail() { echo "[docs-check][fail] $1"; exit 1; }

# Required metadata by doc class
check_metadata_file() {
  local f="$1"
  grep -Eq '(^- version:|\*\*version:\*\*)' "$f" || fail "$f missing metadata: version"
  grep -Eq '(^- owner_role:|\*\*owner_role:\*\*|\*\*owner:\*\*)' "$f" || fail "$f missing metadata: owner_role/owner"
  grep -Eq '(^- review_cadence:|\*\*review_cadence:\*\*|\*\*review cadence:\*\*)' "$f" || fail "$f missing metadata: review_cadence"
  grep -Eq '(^- next_review_due:|\*\*next_review_due:\*\*|\*\*next review due:\*\*)' "$f" || fail "$f missing metadata: next_review_due"
  # date format YYYY-MM-DD
  local d
  d=$(grep -E '(^- next_review_due:|^- \*\*next_review_due:\*\*|^- \*\*next review due:\*\*|\*\*next_review_due:\*\*|\*\*next review due:\*\*)' "$f" | head -n1 | sed -E 's/^- next_review_due:[[:space:]]*//; s/^- \*\*next_review_due:\*\*[[:space:]]*//; s/^- \*\*next review due:\*\*[[:space:]]*//; s/^\*\*next_review_due:\*\*[[:space:]]*//; s/^\*\*next review due:\*\*[[:space:]]*//')
  [[ "$d" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]] || fail "$f invalid next_review_due date format: $d"
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