# staging deploy baseline (web + api)

## metadata
- version: v1.0.1
- owner_role: agent_technical_delivery
- review_cadence: biweekly
- next_review_due: 2026-03-22

## goal
Deploy the current `apps/web` and `services/api` baselines to a single staging host using Docker Compose.

## files
- `apps/web/Dockerfile`
- `services/api/Dockerfile`
- `docker-compose.staging.yml`
- `infra/environments/staging/.env.staging.example`

## env contract
Create `infra/environments/staging/.env.staging` from example:

```bash
cp infra/environments/staging/.env.staging.example infra/environments/staging/.env.staging
```

Required for production readiness behavior:
- `API_READY_TOKEN` (must be non-empty for `GET /ready` to return `200` when `API_NODE_ENV=production`)

Optional (with defaults):
- `API_PORT` (default `8080`)
- `API_HOST_PORT` (default `8080`)
- `API_APP_NAME` (default `moltch-api`)
- `WEB_PORT` (default `3000`)
- `WEB_HOST_PORT` (default `3000`)

## deploy
From repo root:

```bash
# build-first baseline deploy
docker compose --env-file infra/environments/staging/.env.staging -f docker-compose.staging.yml up -d --build

# immutable image-ref deploy (no rebuild)
docker compose --env-file infra/environments/staging/.env.staging -f docker-compose.staging.images.yml up -d
```

## post-deploy validation checklist
1. Containers healthy:
```bash
docker compose --env-file infra/environments/staging/.env.staging -f docker-compose.staging.yml ps
```
2. One-command smoke verification:
```bash
WEB_PORT=${WEB_HOST_PORT:-3000} API_PORT=${API_HOST_PORT:-8080} EXPECTED_READY_STATUS=200 ./scripts/staging/smoke.sh
```
Example for pre-token production check (`/ready` expected 503):
```bash
WEB_PORT=${WEB_HOST_PORT:-3000} API_PORT=${API_HOST_PORT:-8080} EXPECTED_READY_STATUS=503 ./scripts/staging/smoke.sh
```
3. Optional direct endpoint checks:
```bash
curl -fsS http://localhost:${API_HOST_PORT:-8080}/health
curl -fsS http://localhost:${API_HOST_PORT:-8080}/ready
curl -fsS http://localhost:${WEB_HOST_PORT:-3000}/ | head -n 5
```
4. Logs quick scan:
```bash
docker compose --env-file infra/environments/staging/.env.staging -f docker-compose.staging.yml logs --tail=100
```

### smoke script usage notes
- default targets: `http://localhost:3000/`, `http://localhost:8080/health`, `http://localhost:8080/ready`
- override host/port/path with env vars: `WEB_HOST`, `WEB_PORT`, `API_HOST`, `API_PORT`, `WEB_PATH`, `API_HEALTH_PATH`, `API_READY_PATH`
- expected statuses are configurable:
  - `EXPECTED_WEB_STATUS` (default `200`)
  - `EXPECTED_HEALTH_STATUS` (default `200`)
  - `EXPECTED_READY_STATUS` (default `200`)
- retry/backoff knobs:
  - `SMOKE_RETRIES` (default `1`)
  - `SMOKE_RETRY_SLEEP_SECONDS` (default `2`)
- output modes:
  - `SMOKE_OUTPUT=plain` (default)
  - `SMOKE_OUTPUT=json` (for CI artifact ingestion)
- exit code contract:
  - `0` = all checks matched expectations
  - `1` = one or more checks failed

## rollback
### fast rollback (stop this staging stack)
```bash
docker compose --env-file infra/environments/staging/.env.staging -f docker-compose.staging.yml down
```

### rollback to previous image tag (when tags are available)
1. Edit `docker-compose.staging.yml` image tags to previous known-good tags.
2. Redeploy:
```bash
docker compose --env-file infra/environments/staging/.env.staging -f docker-compose.staging.yml up -d
```

## deploy guardrails CI mapping (issue #65)
Acceptance-criteria mapping:
- AC1 (`CI fails when staging deploy integrity checks fail`)
  - workflow step: `AC1 - staging compose/env/docs integrity (fail-closed)`
  - script: `scripts/staging/check_deploy_integrity.sh`
- AC1 (immutable image checks)
  - workflow step: `AC1 - immutable image-ref guardrail (fail-closed)`
  - script: `scripts/staging/check_image_refs_immutable.sh`
- AC3 (`smoke test script wiring validated in CI path`)
  - workflow step: `AC3 - smoke script wiring sanity (pass path)`
  - script: `scripts/staging/smoke.sh`
- AC3 intentional-failure evidence
  - workflow step: `AC3 - smoke script fail-closed proof (intentional failure)`
  - expected outcome: step passes only when smoke script exits non-zero and reports `"result":"fail"`

## branch protection required checks delta
Before:
- `repo-baseline`

After:
- `repo-baseline`
- `deploy-guardrails` (required for PRs touching staging deploy/docs/guardrail paths)

## notes
- This is a staging-first baseline, not production HA.
- For immutable tag-based staging deploys, use `docker-compose.staging.images.yml` (see `docs/operations/STAGING_IMAGE_VERSIONING.md`).
- Optional edge + TLS routing baseline: see `docs/operations/STAGING_EDGE_TLS.md`.
- Add external secrets management before production.
