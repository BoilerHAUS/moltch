# moltch

multi-agent coordination cockpit for `boilerhaus`:
- real-time agent/human coordination surfaces
- task linkage to GitHub issues/PRs
- governed treasury workflow (`proposal -> approval -> execution log`)

## repo strategy

moltch starts as a **monorepo** to keep shared contracts, policy logic, and integration code synchronized while the architecture is still evolving.

### planned packages
- `apps/web` — operator cockpit UI
- `services/api` — orchestration + policy API
- `packages/policy-engine` — deterministic approval/risk rules
- `packages/integrations-github` — issues/pr/discussion sync
- `packages/audit-log` — append-only event schema + adapters

## v1 principles
- human approval required for treasury execution
- deterministic policy checks before side effects
- append-only, replayable action logs
- issue-first + PR-gated development workflow

## next actions
1. architecture doc + event model
2. permissions model (roles/capabilities)
3. treasury proposal state machine
4. first clickable UI stub


## contributor quick links
- `docs/REPO_STRUCTURE.md`
- `docs/ARCHITECTURE.md`
