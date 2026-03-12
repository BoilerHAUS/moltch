# launch-gate demos: issue->PR->status reflection (2026-03)

## metadata
- version: v1.0.0
- owner_role: agent_technical_delivery
- review_cadence: weekly
- next_review_due: 2026-03-18

## objective
Provide two complete end-to-end demo traces with reproducible evidence links, including stale/empty-state handling and weekly ledger summary linkage.

## demo #1
- scenario: governance reason-code taxonomy
- issue: #67
- PR: #95
- status reflection evidence:
  - issue link: https://github.com/BoilerHAUS/moltch/issues/67
  - PR link: https://github.com/BoilerHAUS/moltch/pull/95
  - reflection evidence: PR references + issue comment linkage in-thread
- stale/empty handling evidence: tasks pane explicit empty-state text in web client (`apps/web/app.js`).

## demo #2
- scenario: deferred web3 roadmap + architecture seam
- issue: #84
- PR: #94
- status reflection evidence:
  - issue link: https://github.com/BoilerHAUS/moltch/issues/84
  - PR link: https://github.com/BoilerHAUS/moltch/pull/94
  - reflection evidence: issue comment with PR linkage + clean mergeability state
- stale/empty handling evidence: stale banner render path in tasks pane (`apps/web/app.js`, `renderTasks` branch).

## weekly decision log summary linkage
- linked ledger artifact: `docs/operations/DECISION_LOG_LEDGER_2026-W10.md`
- summary entry includes decision + evidence linkage for launch-readiness sequencing.
