# moltch

> Governance-first execution cockpit for human + agent teams.

moltch keeps execution trustworthy when multiple people and AI agents are shipping in parallel. It ties thread context, GitHub issue/PR state, and approval decisions into one auditable operating surface.

## The problem
Fast teams break down when decisions and delivery data are split across chat, issues, PRs, and docs:
- unclear decision ownership
- approvals that are implied instead of explicit
- issue/PR execution drift
- weak launch evidence for go/hold/no-go calls

## What moltch does
moltch gives operators a governance-first control loop:
1. **Capture context** from active work threads
2. **Link execution state** to issue/PR artifacts
3. **Apply policy decisions** with explicit reason codes
4. **Gate launches** with fail-closed contract/evidence checks

## Who this is for
- small operator teams running human+agent software delivery
- teams that need auditable approvals and decision trails
- teams that want reliability signals before launch decisions

## Who this is not for
- solo toy projects with no review/approval requirements
- teams that do not need traceability across decisions and code changes

## How it works (v1)
```mermaid
flowchart LR
  T[Thread context] --> C[Cockpit]
  I[GitHub Issues/PRs] --> C
  C --> P[Policy decision + reason code]
  P --> E[Evidence artifacts]
  E --> G[Launch gate\n(go / hold / no-go)]
```

## Proof of reliability (shipped)
- Launch-gate evidence schema + validator:
  - `docs/operations/LAUNCH_GATE_EVIDENCE_PACKAGE_SCHEMA_V1.md`
  - `docs/operations/schemas/LAUNCH_GATE_EVIDENCE_PACKAGE_V1.schema.json`
  - `scripts/ops/validate_launch_gate_evidence.py`
- Dedicated launch-gate contracts CI signal:
  - `.github/workflows/launch-gate-contracts.yml`
- Canonical launch evidence index for signoff:
  - `docs/operations/evidence/LAUNCH_EVIDENCE_INDEX_2026-03.md`
- Governance reason-code catalog + conformance evidence:
  - `docs/governance/POLICY_DECISION_REASON_CODE_CATALOG_V1_2.md`
  - `docs/governance/evidence/POLICY_DECISION_CONFORMANCE_SUMMARY_2026-03-14.md`

## Quickstart (10-minute operator path)
### 1) Clone and enter repo
```bash
git clone https://github.com/BoilerHAUS/moltch.git
cd moltch
```

### 2) Run docs + contract checks
```bash
bash scripts/docs/check_docs.sh
```

Expected outcome: all checks pass with explicit fail reasons if anything drifts.

### 3) Review launch signoff entrypoint
```bash
sed -n '1,200p' docs/operations/evidence/LAUNCH_EVIDENCE_INDEX_2026-03.md
```

## Current status
- **Shipped now:** governance/ops contracts, launch-gate evidence tooling, policy conformance checks, roadmap/CI drift guardrails
- **In progress:** README polish + operator onboarding refinement + test-readiness handoff

See canonical roadmap mapping: `docs/product/ROADMAP_V1.md`

## Repository map
- Web app scaffold: `apps/web/`
- API scaffold: `services/api/`
- Governance docs/contracts: `docs/governance/`
- Operations runbooks/evidence: `docs/operations/`
- Product/commercial execution docs: `docs/product/`

## Key docs
- Docs index: `docs/README.md`
- Architecture: `docs/ARCHITECTURE.md`
- Runbook: `docs/operations/RUNBOOK_V1.md`
- Contribution contract: `docs/CONTRIBUTING.md`

## Contributing
- issue-first flow
- fork + branch execution
- PR-gated changes to `BoilerHAUS/moltch:main`
- no direct push to protected default branch
- merge only after review + required checks
