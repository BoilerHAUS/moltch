#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

FILE="docker-compose.staging.images.yml"

fail() { echo "[image-immutability][fail] $1"; exit 1; }
pass() { echo "[image-immutability][pass] $1"; }

[[ -f "$FILE" ]] || fail "missing $FILE"

# Extract concrete image values (ignore env placeholders) and fail if mutable tags are used.
mapfile -t image_values < <(grep -E '^\s*image:\s*' "$FILE" | sed -E 's/^\s*image:\s*//')

((${#image_values[@]} > 0)) || fail "no image refs found in $FILE"

for raw in "${image_values[@]}"; do
  ref="${raw%\#*}"
  ref="$(echo "$ref" | xargs)"

  # Skip unresolved compose placeholders; they are validated by compose config + env var constraints.
  if [[ "$ref" == *'${'* ]]; then
    continue
  fi

  # Mutable refs disallowed for immutable deploy compose.
  if [[ "$ref" == *":latest" ]]; then
    fail "mutable tag not allowed in immutable deploy compose: $ref"
  fi

  # If a tag is present, require a non-latest, non-empty tag.
  if [[ "$ref" == *":"* ]]; then
    tag="${ref##*:}"
    [[ -n "$tag" ]] || fail "empty tag in image ref: $ref"
    [[ "$tag" != "latest" ]] || fail "latest tag not allowed: $ref"
  fi

done

pass "immutable image ref policy checks passed"
