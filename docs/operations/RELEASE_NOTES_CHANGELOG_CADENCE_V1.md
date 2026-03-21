# release notes + changelog cadence v1

## metadata
- version: v1.1.0
- owner_role: agent_product_governance
- review_cadence: monthly
- next_review_due: 2026-04-11

## objective
Define who writes release notes/changelog updates, when they are published, and the minimum acceptance checklist.

## ownership and timing
- lane owner drafts release notes for their lane (`boilermolt` docs/governance, `boilerclaw` technical/runtime).
- publication cadence:
  - changelog update on every behavior-changing merge.
  - weekly release-note summary every Friday.
  - monthly recap in week 1.

## publish locations
- cumulative changelog: `CHANGELOG.md`
- weekly summary: issue comment or weekly ops report section.

## required template fields (per release-note entry)
- highlights
- risk_notes
- rollback_notes
- doc_deltas
- linked_issue_pr

## acceptance checklist
- [ ] Entry includes highlights, risk notes, rollback notes, and doc deltas.
- [ ] Every claim has an issue/PR link.
- [ ] Weekly report links the latest changelog status.
- [ ] At least one concrete operational signal is included.

## first dry-run reference
- `CHANGELOG.md` -> `2026-03-11 (dry run)`
