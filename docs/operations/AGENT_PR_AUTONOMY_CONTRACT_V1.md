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
