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
SMOKE_RETRIES="${SMOKE_RETRIES:-1}"
SMOKE_RETRY_SLEEP_SECONDS="${SMOKE_RETRY_SLEEP_SECONDS:-2}"
SMOKE_OUTPUT="${SMOKE_OUTPUT:-plain}" # plain|json

web_url="${WEB_SCHEME}://${WEB_HOST}:${WEB_PORT}${WEB_PATH}"
health_url="${API_SCHEME}://${API_HOST}:${API_PORT}${API_HEALTH_PATH}"
ready_url="${API_SCHEME}://${API_HOST}:${API_PORT}${API_READY_PATH}"

results=()

check_status() {
  local name="$1" url="$2" expected="$3"
  local attempt=1 actual="000"

  while (( attempt <= SMOKE_RETRIES )); do
    actual=$(curl -sS --max-time "$CURL_TIMEOUT_SECONDS" -o /dev/null -w "%{http_code}" "$url" || true)
    if [[ "$actual" == "$expected" ]]; then
      results+=("$name|$expected|$actual|$url|pass")
      return 0
    fi

    if (( attempt < SMOKE_RETRIES )); then
      sleep "$SMOKE_RETRY_SLEEP_SECONDS"
    fi
    ((attempt++))
  done

  results+=("$name|$expected|$actual|$url|fail")
  return 1
}

overall=0

check_status "web" "$web_url" "$EXPECTED_WEB_STATUS" || overall=1
check_status "api health" "$health_url" "$EXPECTED_HEALTH_STATUS" || overall=1
check_status "api ready" "$ready_url" "$EXPECTED_READY_STATUS" || overall=1

if [[ "$SMOKE_OUTPUT" == "json" ]]; then
  printf '{"checks":['
  first=true
  for row in "${results[@]}"; do
    IFS='|' read -r name expected actual url status <<< "$row"
    if [[ "$first" == false ]]; then printf ','; fi
    first=false
    printf '{"name":"%s","expected":"%s","actual":"%s","url":"%s","status":"%s"}' \
      "$name" "$expected" "$actual" "$url" "$status"
  done
  if [[ $overall -eq 0 ]]; then
    printf '],"result":"pass"}\n'
  else
    printf '],"result":"fail"}\n'
  fi
else
  echo "running staging smoke checks..."
  for row in "${results[@]}"; do
    IFS='|' read -r name expected actual url status <<< "$row"
    if [[ "$status" == "pass" ]]; then
      echo "[pass] ${name}: ${actual} (${url})"
    else
      echo "[fail] ${name}: expected ${expected}, got ${actual} (${url})"
    fi
  done
  if [[ $overall -eq 0 ]]; then
    echo "all staging smoke checks passed"
  fi
fi

exit $overall
