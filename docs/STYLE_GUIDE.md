# docs style guide

## metadata contract
For docs under `docs/governance`, `docs/product`, and `docs/operations`, include metadata block:

- version
- owner_role
- review_cadence
- next_review_due (YYYY-MM-DD)

Example:

```md
## metadata
- version: v1.0.0
- owner_role: agent_product_governance
- review_cadence: weekly
- next_review_due: 2026-03-15
```

## link hygiene
- Use relative doc links wrapped in backticks for consistency, e.g. `docs/operations/RUNBOOK_V1.md`.
- Keep docs index (`docs/README.md`) updated when adding/removing key docs.

## review discipline
- If metadata changes, update `next_review_due` explicitly.
- Keep docs concise and decision-usable.
