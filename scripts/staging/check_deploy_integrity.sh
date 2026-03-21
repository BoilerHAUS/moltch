#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

ENV_EXAMPLE="infra/environments/staging/.env.staging.example"

fail() { echo "[staging-check][fail] $1"; exit 1; }
pass() { echo "[staging-check][pass] $1"; }

[[ -f "$ENV_EXAMPLE" ]] || fail "missing $ENV_EXAMPLE"

# 1) compose rendering checks (single + overlay combinations)
docker compose --env-file "$ENV_EXAMPLE" -f docker-compose.staging.yml config >/dev/null
docker compose --env-file "$ENV_EXAMPLE" -f docker-compose.staging.yml -f docker-compose.staging.edge.yml config >/dev/null
docker compose --env-file "$ENV_EXAMPLE" -f docker-compose.staging.images.yml config >/dev/null
pass "compose files render correctly"

# 2) env key coverage: .env.example must include all compose vars
compose_vars=$(grep -rhoP '(?<!\$)\$\{[A-Z0-9_]+(:-[^}]*)?\}' docker-compose.staging*.yml | sed -E 's/\$\{([A-Z0-9_]+).*/\1/' | sort -u)
env_keys=$(grep -E '^[A-Z0-9_]+=' "$ENV_EXAMPLE" | sed -E 's/=.*//' | sort -u)

while IFS= read -r key; do
  [[ -z "$key" ]] && continue
  echo "$env_keys" | grep -qx "$key" || fail "missing env key in $ENV_EXAMPLE: $key"
done <<< "$compose_vars"
pass "env keys cover compose variable usage"

# 3) deploy-doc references exist
docs=(
  "docs/operations/DEPLOY_STAGING.md"
  "docs/operations/STAGING_EDGE_TLS.md"
  "docs/operations/STAGING_IMAGE_VERSIONING.md"
)

for d in "${docs[@]}"; do
  [[ -f "$d" ]] || fail "missing required deploy doc: $d"
done

# verify key files are referenced in deploy docs
for ref in docker-compose.staging.yml docker-compose.staging.edge.yml docker-compose.staging.images.yml infra/environments/staging/.env.staging.example; do
  grep -Rqs "$ref" docs/operations/DEPLOY_STAGING.md docs/operations/STAGING_EDGE_TLS.md docs/operations/STAGING_IMAGE_VERSIONING.md || fail "deploy docs missing reference: $ref"
done

pass "deploy docs/file references are consistent"

echo "[staging-check][pass] all staging deploy integrity checks passed"
