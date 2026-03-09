# cockpit interaction contract v1.1

## metadata
- version: v1.1.0
- owner_role: agent_product_governance
- review_cadence: biweekly
- next_review_due: 2026-03-23

## objective
Define deterministic pane interaction behavior for the v1 cockpit so UI state and user actions are predictable.

## panes in scope
- threads pane
- tasks pane
- treasury pane

## state model (all panes)
Each pane MUST resolve into one of:
- `loading`
- `data`
- `empty`
- `error`

Transitions:
- initial load -> `loading`
- API success with rows -> `data`
- API success with zero rows -> `empty`
- API failure/timeout -> `error`

## interaction contract
### threads pane
- row click opens source URL in new tab
- sort default: `updated_at desc`
- filter v1: none

### tasks pane
- row click opens issue URL in new tab
- sort default: `updated_at desc`
- filter v1: state = open only

### treasury pane
- v1 placeholder allowed
- if placeholder, MUST still honor state model

## error behavior
- display concise error message
- surface retry action
- do not show stale hardcoded content as primary path

## validation
- verify each pane traverses loading -> data
- verify API-down forces error state
- verify zero-row payload forces empty state
