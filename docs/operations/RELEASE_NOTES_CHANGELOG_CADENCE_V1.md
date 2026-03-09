# release notes + changelog cadence v1

## metadata
- version: v1.0.0
- owner_role: agent_product_governance
- review_cadence: monthly
- next_review_due: 2026-04-08

## objective
Create a lightweight release communication cadence that keeps cross-lane visibility current.

## required artifacts
- `CHANGELOG.md` (repo root) for cumulative change history
- weekly release note post (issue comment or discussion summary)

## cadence
- changelog update: every merged PR that changes behavior
- weekly release note: once per week (Friday target)
- monthly recap: first week of month

## minimum entry schema
- date
- change summary
- issue/PR link
- risk class (`low|medium|high`)
- rollback note (`yes/no + location`)

## ownership
- lane owner drafts entries for their lane
- cross-lane reviewer validates clarity and links

## quality gates
- no “misc fixes” entries without references
- every release note must include at least one metric or operational signal
