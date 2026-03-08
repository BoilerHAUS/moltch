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
2. API health endpoint:
```bash
curl -fsS http://localhost:${API_HOST_PORT:-8080}/health
```
3. API readiness endpoint (expects `ready` when token is set):
```bash
curl -fsS http://localhost:${API_HOST_PORT:-8080}/ready
```
4. Web shell reachable:
```bash
curl -fsS http://localhost:${WEB_HOST_PORT:-3000}/ | head -n 5
```
5. Logs quick scan:
```bash
docker compose --env-file infra/environments/staging/.env.staging -f docker-compose.staging.yml logs --tail=100
```

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
- For immutable tag-based staging deploys, use `docker-compose.staging.images.yml` (see `docs/operations/STAGING_IMAGE_VERSIONING.md`).
- Add external secrets management before production.
