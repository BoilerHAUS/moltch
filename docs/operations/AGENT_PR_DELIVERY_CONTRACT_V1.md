# agent pr delivery contract v1

## metadata
- version: v1.0.0
- owner_role: agent_technical_delivery
- review_cadence: weekly
- next_review_due: 2026-03-27

## objective
Make issue-first agent delivery actually finish the last mile: pre-merge validation, CI/conflict remediation, and post-merge reconciliation must happen without requiring a human to manually remind the agent.

## scope
This contract applies to any agent-owned change that opens or updates a PR against `BoilerHAUS/moltch:main`.

## normative flow
1. Start from an open issue and use a fork branch.
2. Open or update the PR with validation evidence and rollback notes.
3. Stay with the PR until it reaches a mergeable state:
   - required CI checks green, or
   - a blocker is explicitly handed to a human with evidence and recommendation.
4. After merge, reconcile branch state, linked issue state, and any follow-up artifacts.

## pre-merge obligations
Before requesting merge, the agent must:
- run the relevant local validation commands for changed surfaces.
- push fixes for any failing CI that are in scope for the PR.
- resolve merge/base conflicts when the PR is no longer mergeable.
- refresh PR body evidence if validation commands or artifact outputs changed.
- re-check GitHub status after each remediation push until the PR is green or a human-only blocker is proven.

## ci remediation contract
If a required check fails, the agent must:
1. inspect the failing job/logs,
2. classify the failure as one of:
   - repo-content regression,
   - flaky/external dependency,
   - missing secret/permission/environment,
   - unrelated upstream breakage,
3. remediate directly when the failure is caused by the PR or by stale branch state,
4. push the fix and wait for checks to re-run,
5. post a concise blocker note only when the remaining failure is outside agent control.

Required blocker note contents:
- failing check name
- proof/log excerpt
- remediation attempts already tried
- recommended next action

## merge-conflict remediation contract
If the PR shows conflicts or stale base state, the agent must:
1. rebase or merge the latest `main` into the branch,
2. resolve conflicts without dropping accepted contract content,
3. rerun affected local validation,
4. force-push only to the fork branch when needed,
5. confirm the PR is mergeable again.

## post-merge reconciliation contract
After merge, the agent must reconcile the delivery record:
- confirm the linked issue auto-closed or close it if policy/workflow requires manual action.
- confirm `main` post-merge CI status for the merged change.
- note any follow-up issue created because work was intentionally deferred.
- prune or mark the delivery branch as merged/complete.
- update any required roadmap/evidence/docs references when the merged PR changed them.

## done criteria
Agent delivery is only complete when all are true:
- PR merged or explicitly handed off as blocked,
- required checks green on the final branch state, or blocker proven external,
- conflicts resolved,
- linked issue/reconciliation actions completed,
- any follow-up work recorded in issue/PR trail.

## human escalation boundary
Escalate only when one of these is true:
- missing credentials, secrets, or protected-environment approval,
- failing external platform dependency the repo cannot remediate from code/docs,
- ambiguous product/governance decision that changes scope,
- branch protection or repository permissions prevent the required action.

When escalating, include:
- current state,
- exact blocker,
- what was already attempted,
- the recommended human decision.

## pr template requirements
The PR template must require explicit checkboxes for:
- local validation run,
- CI follow-through,
- conflict remediation,
- post-merge reconciliation notes or `n/a` rationale.

## related docs
- contribution workflow: `docs/CONTRIBUTING.md`
- operations runbook: `docs/operations/RUNBOOK_V1.md`
- branch protection: `docs/BRANCH_PROTECTION.md`
