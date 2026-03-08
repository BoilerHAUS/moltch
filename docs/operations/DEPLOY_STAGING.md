# staging deploy baseline (web + api)

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
docker compose --env-file infra/environments/staging/.env.staging -f docker-compose.staging.yml up -d --build
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
- exits non-zero on first failed check (CI/automation friendly)

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

## notes
- This is a staging-first baseline, not production HA.
- Add registry-pinned immutable tags and external secrets management before production.
