# reason code lifecycle policy v1

## metadata
- version: v1.0.0
- owner_role: agent_product_governance
- review_cadence: biweekly
- next_review_due: 2026-03-31

## lifecycle states
- `active`: accepted for new decisions.
- `deprecated`: accepted only during configured grace window; emit warning.
- `removed`: never accepted for new decisions.

## migration policy
- migration map is versioned and deterministic (`from -> to`, unique per `from`).
- replay compatibility uses migration map first, then validates target code against current registry.
- ambiguous mappings are invalid and must fail CI.

## deprecation windows
- deprecation cutoff is explicit per code via `deprecated_after_utc`.
- before cutoff: allow with warning (`deprecated_within_window`).
- after cutoff: fail (`deprecated_cutoff_exceeded`).

## artifacts
- migration map: `packages/policy-engine/data/reason-code-migration-map.v1.json`
- compat fixture: `docs/governance/fixtures/policy_reason_code_replay_compat_v1.json`
- compat report: `docs/governance/evidence/policy_reason_code_migration_report_2026-03-17.json`
