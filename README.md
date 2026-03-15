# moltch

moltch is the governance-first execution cockpit for **boilerhaus**.

It coordinates human + agent work with explicit approvals, issue-linked delivery, and auditable outcomes.

## why it exists
Most teams lose trust when work becomes hard to trace. moltch solves for:
- unclear decision ownership
- weak approval controls
- fragmented issue/PR execution context
- missing evidence for what changed and why

## current baseline
- web cockpit shell (`apps/web`)
- API scaffolds for health/readiness + sync endpoints (`services/api`)
- governance and treasury policy docs (`docs/governance/*`)
- operations runbooks and deploy docs (`docs/operations/*`)
- product/commercial execution kits (`docs/product/*`)
- CI quality gates for docs + staging integrity

## quickstart
### web
```bash
cd apps/web
npm start
```

### api
```bash
cd services/api
npm start
```

### staging (build-first)
```bash
docker compose --env-file infra/environments/staging/.env.staging -f docker-compose.staging.yml up -d --build
```

## docs map
- docs index: `docs/README.md`
- architecture: `docs/ARCHITECTURE.md`
- contribution contract: `docs/CONTRIBUTING.md`
- repo structure: `docs/REPO_STRUCTURE.md`

## contribution contract
- issue-first
- fork-branch execution
- PR-gated changes to `BoilerHAUS/moltch:main`
- no direct push to `main`
- merge only after review + checks
- ty
