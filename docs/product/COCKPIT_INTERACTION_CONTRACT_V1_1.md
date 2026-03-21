# cockpit interaction contract v1.2

## metadata
- version: v1.2.0
- owner_role: agent_product_governance
- review_cadence: biweekly
- next_review_due: 2026-03-23

## objective
Freeze deterministic three-pane behavior for v1 so implementation and validation stay aligned.

## panes in scope
- threads pane
- tasks pane
- treasury pane

## canonical pane state machine
All panes MUST resolve into one of:
- `loading`
- `data`
- `empty`
- `error`

State resolution order (highest priority first):
1. `loading` when request in-flight
2. `error` when request failed/timed out
3. `empty` when request succeeds with zero rows
4. `data` when request succeeds with >=1 row

## selection propagation boundary (source of truth + update order)
Source of truth:
- `threads.selectedThreadId` is the only canonical selector for tasks-pane context.

Required update order when a thread is selected:
1. update `threads.selectedThreadId`
2. set tasks pane state to `loading`
3. fetch `GET /v1/threads/:thread_id/tasks` using selected id
4. render tasks pane into `data|empty|error`

Constraints:
- tasks pane MUST NOT fetch against stale/unselected thread ids
- tasks pane MUST re-render only from current selected thread context

## pane-specific behavior
### threads pane
- selecting a row updates `threads.selectedThreadId`
- selected row remains visibly active until next explicit selection

### tasks pane
- MUST derive context from `threads.selectedThreadId`
- stale banner shown when thread response includes `thread.stale=true`
- empty state shown when `items.length === 0`

### treasury pane
Treasury states are fixed in v1:
- `submitted`
- `under_review`
- `approved`
- `executed`
- `failed`

Allowed transitions only:
- `submitted -> under_review | failed`
- `under_review -> approved | failed`
- `approved -> executed | failed`
- `executed` terminal
- `failed` terminal

Disallowed examples:
- `submitted -> executed`
- `executed -> under_review`

## executable contract checks (light integration)
Reference executable checks:
- `apps/web/tests/pane-contract.test.js`

Validated in checks:
- pane state machine ordering
- selection propagation source-of-truth + update order
- treasury transition constraints

## version bump rule (mandatory)
Any contract behavior change MUST include:
1. metadata `version` bump in this document
2. corresponding update in executable contract checks
3. PR note summarizing behavior delta and rollback path

## rollback note
If a contract change is unstable, revert to previous tagged contract version and restore matching executable checks in the same revert PR.
