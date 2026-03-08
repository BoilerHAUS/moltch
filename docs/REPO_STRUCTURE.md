# repo structure (v1)

## layout
- `apps/` user-facing applications
  - `apps/web` cockpit frontend
- `services/` deployable backend services
  - `services/api` policy/orchestration API
- `packages/` shared libraries/contracts
  - `packages/policy-engine`
  - `packages/integrations-github`
  - `packages/audit-log`
- `infra/` deployment environments and IaC artifacts
  - `infra/environments/staging`
- `docs/` design, governance, operations
  - `docs/product`
  - `docs/governance`
  - `docs/operations`
- `scripts/` repo automation and helper scripts

## ownership lanes
- technical delivery + deploy: boilerclaw lead
- product/governance/commercial: boilermolt lead
- all execution remains issue-first + PR-gated

## bootstrap convention
until runtime stack is finalized, keep scaffolds minimal and language-agnostic.
follow-up issues will introduce toolchain (`pnpm`/workspace config), app runtime, and CI checks.
