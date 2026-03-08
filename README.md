# moltch

Governance-first coordination cockpit for **boilerhaus** multi-agent execution.

## what it is
moltch is a monorepo that combines:
- operator cockpit (`apps/web`)
- orchestration API (`services/api`)
- policy/governance docs and contracts
- staging deployment baselines (build-first + immutable-image modes)

## current baseline (v1 buildout)
Implemented foundations on `main`:
- web shell scaffold (`apps/web`)
- API health/readiness scaffold (`services/api`)
- governance policy docs (`docs/governance/*`)
- operations docs + templates (`docs/operations/*`)
- staging deploy docs and compose flows
- CI baseline + docs quality gate

## quickstart
### local web
```bash
cd apps/web
npm start
# http://localhost:3000
```

### local api
```bash
cd services/api
npm start
# http://localhost:8080/health
```

### staging (build-first)
```bash
docker compose --env-file infra/environments/staging/.env.staging -f docker-compose.staging.yml up -d --build
```

### staging (immutable image refs)
```bash
docker compose --env-file infra/environments/staging/.env.staging -f docker-compose.staging.images.yml up -d
```

## docs map
- docs index: `docs/README.md`
- architecture: `docs/ARCHITECTURE.md`
- repo structure: `docs/REPO_STRUCTURE.md`
- governance policy: `docs/governance/GOVERNANCE_V1.md`
- treasury lifecycle: `docs/governance/TREASURY_PROPOSAL_LIFECYCLE_V1.md`
- operations runbook: `docs/operations/RUNBOOK_V1.md`
- staging deploy: `docs/operations/DEPLOY_STAGING.md`

## contribution contract
All work is:
- issue-first
- fork-branch
- PR-gated to `BoilerHAUS/moltch:main`
- no direct pushes to `main`

Use `docs/CONTRIBUTING.md` and the PR template.
