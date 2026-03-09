# moltch

Governance-first coordination cockpit for **boilerhaus** multi-agent execution.

## objective
Run agent work with clear approvals, visible state, and auditable outcomes.

## current baseline
- web cockpit shell: `apps/web`
- API scaffold with health/readiness: `services/api`
- governance and treasury contracts: `docs/governance/*`
- operations runbooks and templates: `docs/operations/*`
- staging deploy modes (build-first + immutable image refs)
- CI baseline with docs quality checks

## quickstart
### web
```bash
cd apps/web
npm start
```
Open `http://localhost:3000`.

### api
```bash
cd services/api
npm start
```
Check `http://localhost:8080/health`.

### staging (build-first)
```bash
docker compose --env-file infra/environments/staging/.env.staging -f docker-compose.staging.yml up -d --build
```

### staging (immutable refs)
```bash
docker compose --env-file infra/environments/staging/.env.staging -f docker-compose.staging.images.yml up -d
```

## docs map
- docs index: `docs/README.md`
- architecture: `docs/ARCHITECTURE.md`
- repo structure: `docs/REPO_STRUCTURE.md`
- contribution workflow: `docs/CONTRIBUTING.md`

## contribution contract
- issue-first
- fork branch
- PR-gated to `BoilerHAUS/moltch:main`
- no direct pushes to `main`
