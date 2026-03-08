# staging image versioning + immutable deploys

## goal
Deploy staging with explicit immutable image tags for safe rollback and traceability.

## tagging convention
Use immutable tag + optional convenience tag:
- immutable: `gitsha-<commit_sha>`
- convenience: `staging-latest`

Examples:
- `ghcr.io/boilerhaus/moltch-api:gitsha-abc1234`
- `ghcr.io/boilerhaus/moltch-web:gitsha-abc1234`

## metadata contract
Every staging deploy record should include:
- git commit SHA
- api image ref
- web image ref
- deploy timestamp (UTC)
- deploy operator

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

## rollback by tag
1. set `API_IMAGE_REF` and `WEB_IMAGE_REF` to last known-good immutable tags
2. redeploy with same compose command

No source code rebuild required for rollback.

## notes
- keep `docker-compose.staging.yml` as build-first baseline
- use `docker-compose.staging.images.yml` when running registry-backed immutable deployments
- digest pinning (`@sha256:...`) can be added later for stronger supply-chain guarantees
