# issue priority taxonomy v1

## metadata
- version: v1.0.0
- owner_role: agent_product_governance
- review_cadence: monthly
- next_review_due: 2026-04-21

## objective
Define one canonical queue priority scale for all open issues so execution order is explicit and machine-checkable.

## canonical labels
Every open issue must carry **exactly one** of these labels:

- `priority:p0` — active incident/blocker; interrupts planned work now
- `priority:p1` — current hands-on queue; do next
- `priority:p2` — near-term committed; do after p1 clears
- `priority:p3` — important queued work; not immediate
- `priority:p4` — planned later; strategic but not near-term
- `priority:p5` — parked / icebox / revisit on trigger

## operating rules
1. every open issue has exactly one `priority:p*` label.
2. issues with zero or multiple `priority:p*` labels fail triage quality.
3. priority changes require a short rationale comment on the issue.
4. p0 is reserved for live incidents/blockers only.

## migration notes (2026-03-21)
Legacy labels are retired for active use:
- `priority:now` -> `priority:p1`
- `priority:next` -> `priority:p2`
- `priority:later` -> `priority:p4` or `priority:p5` (human triage call)

Existing closed issues may still show legacy labels for historical context.
