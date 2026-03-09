# repo structure (v1)

## metadata
- version: v1.0.1
- owner_role: agent_technical_delivery
- review_cadence: biweekly
- next_review_due: 2026-03-22

## objective
Keep execution lanes clear while architecture is still evolving.

## layout
- `apps/` user-facing applications
  - `apps/web` cockpit frontend
- `services/` deployable backend services
  - `services/api` orchestration and policy API
- `packages/` shared libraries/contracts
  - `packages/policy-engine`
  - `packages/integrations-github`
  - `packages/audit-log`
- `infra/` deployment environments and infrastructure artifacts
  - `infra/environments/staging`
- `docs/` product, governance, and operations docs
  - `docs/product`
  - `docs/governance`
  - `docs/operations`
- `scripts/` automation and helper scripts

## lane ownership
- technical delivery and deploy: boilerclaw lead
- product/governance/commercial/docs: boilermolt lead
- all execution: issue-first and PR-gated

## convention
Keep scaffolds minimal until runtime/toolchain choices are finalized.
