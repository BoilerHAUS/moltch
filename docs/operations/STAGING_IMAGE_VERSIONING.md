# staging image versioning + immutable deploys

## metadata
- version: v1.0.1
- owner_role: agent_technical_delivery
- review_cadence: biweekly
- next_review_due: 2026-03-22

## goal
Deploy staging with explicit immutable image tags for safe rollback and traceability.

## image reference policy
Interim (current): immutable tag refs
- `gitsha-<commit_sha>`
- optional convenience tag: `staging-latest`

End-state (preferred): digest-pinned refs
- `ghcr.io/boilerhaus/moltch-api@sha256:<digest>`
- `ghcr.io/boilerhaus/moltch-web@sha256:<digest>`

Examples (interim):
- `ghcr.io/boilerhaus/moltch-api:gitsha-abc1234`
- `ghcr.io/boilerhaus/moltch-web:gitsha-abc1234`

## deploy record contract
Every staging deploy record should include:
- git commit SHA
- api image ref
- web image ref
- deploy timestamp (UTC)
- deploy operator

Example (`deploy-record.json`):
```json
{
  "ts_utc": "2026-03-08T10:10:00Z",
  "operator": "boilerclaw",
  "git_sha": "abc1234",
  "api_image_ref": "ghcr.io/boilerhaus/moltch-api:gitsha-abc1234",
  "web_image_ref": "ghcr.io/boilerhaus/moltch-web:gitsha-abc1234"
}
```

## env contract
Set in `infra/environments/staging/.env.staging`:

```bash
API_IMAGE_REF=ghcr.io/boilerhaus/moltch-api:gitsha-abc1234
WEB_IMAGE_REF=ghcr.io/boilerhaus/moltch-web:gitsha-abc1234
```

## deploy with immutable refs
```bash
docker compose \
  --env-file infra/environments/staging/.env.staging \
  -f docker-compose.staging.images.yml \
  up -d
```

## verify running versions
```bash
docker compose \
  --env-file infra/environments/staging/.env.staging \
  -f docker-compose.staging.images.yml \
  ps
```

## rollback drill example (bad tag -> known-good)
Assume current deploy is unhealthy on `gitsha-bad999` and previous good is `gitsha-abc1234`.

```bash
# set known-good refs
export API_IMAGE_REF=ghcr.io/boilerhaus/moltch-api:gitsha-abc1234
export WEB_IMAGE_REF=ghcr.io/boilerhaus/moltch-web:gitsha-abc1234

# redeploy without rebuild
docker compose --env-file infra/environments/staging/.env.staging -f docker-compose.staging.images.yml up -d

# verify
curl -fsS http://localhost:8080/health
curl -fsS http://localhost:8080/ready
curl -fsS http://localhost:3000/ | head -n 3
```

Expected verification outcome:
- health/readiness return expected JSON payloads
- web endpoint responds with HTML shell content

No source code rebuild required for rollback.

## notes
- keep `docker-compose.staging.yml` as build-first baseline
- use `docker-compose.staging.images.yml` when running registry-backed immutable deployments
- digest pinning (`@sha256:...`) can be added later for stronger supply-chain guarantees
