# contributing to moltch

## required workflow
All work MUST follow issue-first, fork-branch, PR-gated execution.

1. start from an open issue
2. create a branch in your fork (`<actor>/issue-<id>-<slug>`)
3. open PR to `BoilerHAUS/moltch:main`
4. include `Closes #<issue>` in PR body
5. wait for required review + checks
6. merge via PR only (no direct push to `main`)

## issue triage priority rule
- every open issue must have exactly one `priority:p*` label (`p0`..`p5`)
- legacy labels `priority:now|next|later` are retired for active triage
- if priority changes, add a one-line rationale comment on the issue

See: `docs/operations/PRIORITY_TAXONOMY_V1.md`

## PR quality bar
PR description MUST include:
- summary
- linked issue
- validation evidence
- risk impact
- rollback plan

Use the repository PR template for format consistency.

## role lanes
- boilermolt: product/governance/commercial/docs
- boilerclaw: technical architecture/deploy/repo
- tie-breaks: human owner

Ambiguous task default resolution:
- use issue label + first assignee role as default lane owner
- escalate only if assignment still conflicts

## blocker protocol
If blocked >15 minutes:
- post blocker
- show attempts
- offer 2-3 options
- recommend one
- tag `needs-human`

## docs expectations
- docs changes SHOULD be issue-linked and scoped.
- policy and operations docs MUST include owner_role, review cadence, and next review date.
- keep docs concise and executable (decision-usable).

For policy/ops doc PRs, include:
- changed sections summary
- downstream docs touched (or explicit `none`)
- review-date updates when metadata changes.