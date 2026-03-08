#!/usr/bin/env bash
set -euo pipefail

WEB_SCHEME="${WEB_SCHEME:-http}"
WEB_HOST="${WEB_HOST:-localhost}"
WEB_PORT="${WEB_PORT:-3000}"
WEB_PATH="${WEB_PATH:-/}"

API_SCHEME="${API_SCHEME:-http}"
API_HOST="${API_HOST:-localhost}"
API_PORT="${API_PORT:-8080}"
API_HEALTH_PATH="${API_HEALTH_PATH:-/health}"
API_READY_PATH="${API_READY_PATH:-/ready}"

EXPECTED_HEALTH_STATUS="${EXPECTED_HEALTH_STATUS:-200}"
EXPECTED_READY_STATUS="${EXPECTED_READY_STATUS:-200}"
EXPECTED_WEB_STATUS="${EXPECTED_WEB_STATUS:-200}"
CURL_TIMEOUT_SECONDS="${CURL_TIMEOUT_SECONDS:-8}"

web_url="${WEB_SCHEME}://${WEB_HOST}:${WEB_PORT}${WEB_PATH}"
health_url="${API_SCHEME}://${API_HOST}:${API_PORT}${API_HEALTH_PATH}"
ready_url="${API_SCHEME}://${API_HOST}:${API_PORT}${API_READY_PATH}"

check_status() {
  local name="$1"
  local url="$2"
  local expected="$3"
  local actual

  actual=$(curl -sS --max-time "$CURL_TIMEOUT_SECONDS" -o /dev/null -w "%{http_code}" "$url" || true)

  if [[ "$actual" != "$expected" ]]; then
    echo "[fail] ${name}: expected ${expected}, got ${actual} (${url})"
    exit 1
  fi

  echo "[pass] ${name}: ${actual} (${url})"
}

echo "running staging smoke checks..."
check_status "web" "$web_url" "$EXPECTED_WEB_STATUS"
check_status "api health" "$health_url" "$EXPECTED_HEALTH_STATUS"
check_status "api ready" "$ready_url" "$EXPECTED_READY_STATUS"
echo "all staging smoke checks passed"
