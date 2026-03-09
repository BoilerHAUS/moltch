# CLAUDE.md

This file provides guidance to Claude Code when working in the **moltch** repository — a governance-first execution cockpit for BoilerHAUS.

## Project Overview

moltch coordinates human and agent work with explicit approvals, issue-linked delivery, and auditable outcomes. It solves unclear decision ownership, weak approval controls, and fragmented execution context.

## Repository Structure

```
apps/web/            # Cockpit frontend shell (Node.js, vanilla JS/HTML/CSS)
services/api/        # Orchestration API (Node.js + Express)
packages/            # Shared libraries (policy-engine, integrations-github, audit-log)
infra/               # Deployment environments (staging)
docs/                # Documentation hub (product, governance, operations)
scripts/             # Automation and quality gate scripts
.github/             # Workflows, CODEOWNERS, PR template
```

## Development Commands

### Local Development

```bash
# Web cockpit (port 3000)
cd apps/web && npm start

# API service (port 8080)
cd services/api && npm start
```

### Staging (Docker)

```bash
docker compose --env-file infra/environments/staging/.env.staging \
  -f docker-compose.staging.yml up -d --build
```

### Quality Gates

```bash
# Validate doc metadata and internal links
bash ./scripts/docs/check_docs.sh

# Verify compose + env consistency
bash ./scripts/staging/check_deploy_integrity.sh
```

### Health Checks

```bash
curl http://localhost:3000/              # Web cockpit
curl http://localhost:8080/health        # API health
curl http://localhost:8080/ready         # API readiness
curl http://localhost:8080/sync/github   # GitHub sync
curl http://localhost:8080/cockpit/summary  # Cockpit summary
```

## Environment Variables

Copy `infra/environments/staging/.env.staging.example` to `.env.staging` before running staging.

Key variables:
- `API_READY_TOKEN` — required for readiness probe in production
- `GITHUB_TOKEN` — optional, recommended to avoid rate limits
- `GITHUB_SYNC_REPO` — default `BoilerHAUS/moltch`

## Git Workflow

This project follows a strict **issue-first, PR-gated** workflow:

1. All work must be linked to an open issue
2. Use fork-branch execution pattern
3. Never push directly to `main` — PRs only
4. Fill out the PR template fully (summary, linked issue, scope, validation, rollback plan)
5. Lane ownership is enforced via `.github/CODEOWNERS`

## Documentation Standards

All docs under `docs/governance/`, `docs/product/`, and `docs/operations/` must include metadata:

```markdown
version: x.y.z
owner_role: <role>
review_cadence: weekly | biweekly | monthly
next_review_due: YYYY-MM-DD
```

Internal links must use backtick-wrapped relative paths (e.g., `` `docs/operations/RUNBOOK_V1.md` ``).

The CI check (`scripts/docs/check_docs.sh`) enforces these standards. Exemptions go in `/docs/.docs-check-ignore`.

## Architecture

See `docs/ARCHITECTURE.md` for the full system design. Key points:
- Stateful domains: approvals, issues, audit log
- Security baseline: token-gated readiness, no secrets in compose files
- GitHub sync is the primary external integration

## Contributing

See `docs/CONTRIBUTING.md` for the full workflow. Blockers must be escalated within 24 hours via the blocker protocol documented there.
