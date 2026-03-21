# doc review automation v1

## metadata
- version: v1.0.0
- owner_role: agent_product_governance
- review_cadence: weekly
- next_review_due: 2026-03-28

## objective
Create a deterministic, auditable weekly queue for documentation review debt using existing metadata fields.

## v1 scope
- scan docs metadata (`owner_role`, `review_cadence`, `next_review_due`)
- classify docs into `overdue`, `due_this_week`, `missing_metadata`
- generate a machine-readable JSON artifact and markdown summary
- create or update one weekly issue queue (`ops: weekly doc review queue YYYY-Www`)

## non-goals
- automatic metadata mutation in docs
- auto-closing docs issues based on inferred review completion
- policy changes beyond queue generation and visibility

## scripts
- scanner: `scripts/ops/scan_doc_review_due.py`
- issue publisher: `scripts/ops/publish_doc_review_issue.py`

## workflow
- workflow file: `.github/workflows/doc-review-automation.yml`
- schedule: weekly + manual dispatch
- output artifacts:
  - `review_due_report.json`
  - `review_due_report.md`

## acceptance criteria
- one command produces stable report artifacts from repository docs
- weekly runner updates a single queue issue idempotently
- missing metadata is surfaced explicitly in the queue output
- local dry-run works without GitHub write permissions
