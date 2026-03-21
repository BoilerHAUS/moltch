# agent pr autonomy contract v1

## metadata
- version: v1.0.0
- owner_role: agent_technical_delivery
- review_cadence: weekly
- next_review_due: 2026-03-28

## objective
Make autonomous PR creation and deterministic PR recovery the default delivery behavior for implementation-ready issues in `moltch`, while keeping human approval and ambiguous scope decisions outside automation.

## scope
This contract applies to repo-local automation in `BoilerHAUS/moltch` for:
- issue readiness evaluation for PR opening
- standardized PR opening behavior
- deterministic conflict / CI recovery on an already-open PR
- auditable thread status updates for autonomous actions

This contract does **not** authorize:
- autonomous merge
- autonomous scope expansion beyond the issue acceptance criteria
- policy/governance reinterpretation when thread intent is ambiguous

## state model
- `discussion_only` — thread is still exploratory; no PR should be opened
- `implementation_ready` — issue has explicit acceptance criteria, bounded scope, and no unresolved ambiguity
- `auto_pr_opened` — implementation-ready issue has a PR opened by automation
- `blocked_needs_human` — automation reached a non-deterministic or policy-sensitive blocker
- `merged_or_closed` — delivery is complete or intentionally stopped

## auto-pr opening gate
Automation may open a PR only when all are true:
- issue has explicit acceptance criteria or equivalent implementation-ready thread instruction
- scope is narrow and reversible
- no unresolved product/policy ambiguity remains in the thread
- rollback plan can be stated deterministically
- no active PR already exists for the issue

Machine-readable readiness artifacts must record:
- `issue_number`
- `state`
- `ready`
- `reasons[]`
- `thread_signals.acceptance_criteria_explicit`
- `thread_signals.scope_bounded`
- `thread_signals.policy_ambiguity_resolved`
- `thread_signals.rollback_noted`
- optional `existing_pr_url`

## autonomous recovery contract
When a PR already exists and is dirty/failing, automation must attempt deterministic remediation before asking for a human:
1. inspect failing check or conflict state
2. classify the failure
3. apply only deterministic fix classes already governed by repo truth
4. rerun local validation
5. push the remediation and update thread status

Allowed deterministic fix classes:
- base-branch refresh / conflict resolution that preserves accepted content
- docs index synchronization
- roadmap open-issue reconciliation
- regenerated deterministic artifacts / fixtures / checksums
- PR body hygiene updates (`Closes`/`Refs`, rollback note, status block)

Escalate to `blocked_needs_human` when any remaining blocker is:
- policy-ambiguous
- externally caused and non-remediable from repo content
- permission/secret/environment bound
- a scope decision rather than a deterministic repair

## required thread audit block
Any autonomous PR opening or remediation action must leave a concise status block in the linked issue or PR thread:
- `done`: action completed
- `next`: expected next machine/human step
- `blocked`: `none` or exact blocker

## appendix: deterministic remediation playbook baseline
| fix_class | allowed_actions | required_post_fix_checks | escalation_boundary |
|---|---|---|---|
| `docs_index_sync` | add missing docs index entry, remove stale index entry, repair index path after doc rename | `bash scripts/docs/check_docs.sh` | escalate if the fix requires deciding whether a doc should exist, be retired, or be excluded from governed coverage |
| `roadmap_reconcile` | remove stale closed-issue row, add missing open-issue row, update tracking row presence to match live open issue set without changing roadmap semantics | `GH_TOKEN="$(gh auth token)" GITHUB_REPOSITORY="BoilerHAUS/moltch" bash scripts/docs/check_docs.sh` | escalate if reconciliation would require changing lane/owner/dependency/target-window semantics rather than restoring canonical tracking truth |
| `deterministic_fixture_regen` | rerun deterministic artifact/fixture/checksum generators already committed in repo workflows, keep regenerated outputs only when they match current source truth | changed package `npm run check` plus `bash scripts/docs/check_docs.sh` when docs/artifacts are touched | escalate if regeneration changes accepted product/policy semantics, introduces nondeterministic drift, or depends on missing external credentials |
| `pr_body_hygiene` | patch `Closes`/`Refs`, rollback note, validation evidence, and required `done / next / blocked` status text in the PR body or thread | `gh pr view <pr> --repo BoilerHAUS/moltch` and confirm required template fields are present | escalate if the missing body content reflects unresolved scope ambiguity rather than a formatting/traceability omission |
| `stale_base_refresh` | rebase or merge latest `main` into the PR branch, resolve conflicts without dropping accepted content, rerun in-scope validations, and force-push only to the fork branch when needed | in-scope package checks plus `bash scripts/docs/check_docs.sh` before push | escalate if conflict resolution requires a new product/policy decision or cannot be completed without altering accepted contract behavior |

Fail-closed rule: if a candidate remediation would change accepted semantics rather than restore repo truth, do not auto-fix; move the PR to `blocked_needs_human` with a concise blocker summary.

## acceptance criteria for this contract
- implementation-ready issues may be admitted to autonomous PR opening without a human “please open PR” nudge
- automation must not infer readiness from PR existence alone
- deterministic conflict/CI remediation must be attempted before escalation
- unresolved ambiguity must fail closed into `blocked_needs_human`
- each automation action must be auditable from thread text or artifacts

## related docs
- `docs/operations/AGENT_PR_DELIVERY_CONTRACT_V1.md`
- `docs/operations/ISSUE_CLASSIFICATION_PR_ADMISSION_V1.md`
- `docs/operations/ROLLBACK_UNDO_SEMANTICS_V1.md`
