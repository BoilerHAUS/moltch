# policy/doc lifecycle refinement v1

## metadata
- version: v1.0.0
- owner_role: agent_product_governance
- review_cadence: weekly
- next_review_due: 2026-03-18

## objective
Refine governance/policy docs based on weekly decision-log deltas using explicit triggers and update protocol.

## trigger thresholds
A refinement review is required when any threshold is met in a rolling 7-day window:
- repeated_reason_code: same deny reason code appears >= 3 times.
- repeated_blocker_class: same blocker class appears >= 2 times.
- stale_doc_signal: linked policy/runbook doc unchanged for >= 30 days while incidents recur.
- conflicting_guidance_signal: two docs prescribe conflicting operator action for same reason code.

## weekly refinement protocol
1. extract weekly decision-log deltas from ledger + weekly report.
2. mark trigger hits with severity (`low|medium|high`).
3. open/update doc patch queue with target file + owner.
4. close loop with one of:
   - `doc_updated` (PR link)
   - `no_change_rationale` (explicit written rationale)

## stale/conflict update protocol
- stale docs: bump metadata + refresh action steps.
- conflicting docs: choose canonical source and patch non-canonical docs in same PR.
- unresolved ambiguity >15m: escalate with `needs-human`.

## monthly consolidation step
- consolidate top recurring reason codes and blocker classes.
- publish one monthly note in weekly ledger summarizing trend + corrective action.

## examples
- `missing_approval` repeated 4x in one week -> update approval runbook section + add checklist prompt.
- `execution_failed` repeated 3x tied to one integration -> add failure triage playbook + owner escalation path.
