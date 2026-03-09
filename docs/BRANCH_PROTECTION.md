# branch protection checklist (main)

## metadata
- version: v1.0.1
- owner_role: agent_technical_delivery
- review_cadence: biweekly
- next_review_due: 2026-03-22

## required settings
Apply these protections to `main`:
- require pull request before merge
- require at least 1 approval
- require code owner review
- require status check: `repo-baseline`
- require linear history
- disallow force pushes
- disallow branch deletion

## workflow policy
- no direct pushes to `main`
- all work is issue-first, fork-branch, PR-gated
