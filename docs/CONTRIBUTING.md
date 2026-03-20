# contributing to moltch

## objective
Keep collaboration predictable, reviewable, and safe.

## required workflow
1. start from an open issue
2. create a branch in your fork (`<actor>/issue-<id>-<slug>`)
3. open PR to `BoilerHAUS/moltch:main`
4. include `Closes #<issue>` in PR body
5. wait for required review and checks
6. merge through PR only (no direct push to `main`)

## PR quality bar
Every PR must include:
- summary
- linked issue
- validation evidence
- risk impact
- rollback plan

Use the repository PR template.

Agent-owned PR follow-through is governed by `docs/operations/AGENT_PR_DELIVERY_CONTRACT_V1.md`.

## lane ownership
- boilermolt: product/governance/commercial/docs
- boilerclaw: technical architecture/deploy/repo
- tie-break: human owner

Ambiguous task rule:
- default lane owner = issue label + first assignee role
- escalate only if conflict remains

## blocker protocol
If blocked >15 minutes:
- post blocker
- show attempts
- provide 2-3 options
- recommend one
- tag `needs-human`

## docs requirements
- doc changes should be issue-linked and scoped
- governed docs scope (strict metadata enforcement):
  - docs/governance/*V1*.md
  - docs/product/*V1*.md
  - docs/operations/*V1*.md
- governed docs must include metadata block exactly:
  - `## metadata`
  - `- version: v<major>.<minor>.<patch>`
  - `- owner_role: agent_product_governance|agent_technical_delivery`
  - `- review_cadence: daily|weekly|biweekly|monthly|quarterly`
  - `- next_review_due: YYYY-MM-DD`
- docs index coverage rule:
  - every docs markdown file (except docs/README.md) must be listed in docs/README.md
- cross-link rule:
  - any docs markdown link/path referenced in docs must resolve to an existing file
- run docs quality gate before PR:
```bash
./scripts/docs/check_docs.sh
```

For policy/ops/product doc PRs, include:
- changed sections summary
- downstream docs touched (or `none`)
- review-date updates when metadata changes

Roadmap mapping discipline:
- every open issue must appear in `docs/product/ROADMAP_V1.md` mapping table, or
- be listed in `excluded issues` with explicit rationale
- CI enforces this via:
```bash
./scripts/docs/check_docs.sh
```

Local troubleshooting (tokened run):
```bash
GH_TOKEN="$(gh auth token)" GITHUB_REPOSITORY="BoilerHAUS/moltch" ./scripts/docs/check_docs.sh
```
eshooting (tokened run):
```bash
GH_TOKEN="$(gh auth token)" GITHUB_REPOSITORY="BoilerHAUS/moltch" ./scripts/docs/check_docs.sh
```
