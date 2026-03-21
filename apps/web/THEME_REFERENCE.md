# governed frontend asset pack reference

## metadata
- version: v1.0.0
- owner_role: shared
- review_cadence: biweekly
- next_review_due: 2026-04-01

## objective
Capture the approved `apps/web` design contract for the first governed cockpit theme slice.

## managed fonts
- body font: `Moltch Sans` loaded from `/assets/fonts/moltch-sans-regular.ttf`
- chrome font: `Moltch Mono` loaded from `/assets/fonts/moltch-mono-regular.ttf`
- production entrypoints should preload the managed font files from `index.html`

## locked visual rules
- dark-first surface hierarchy
- `policy-cyan` is the primary interactive accent
- `agent-violet` is reserved for agent/system distinction
- verdict colors are reserved for real `go` / `hold` / `no-go` semantics only
- mono is for chrome, labels, metadata, and structured controls
- sans is for body copy, prose, and input text
- flat operator-cockpit feel: borders over decorative shadows, no gradients, no blur

## token set
### surfaces
- `--color-command`
- `--color-cockpit`
- `--color-grid`
- `--color-grid-hover`

### text ramp
- `--color-signal`
- `--color-ghost`
- `--color-trace`

### accents
- `--color-policy-cyan`
- `--color-policy-cyan-bg`
- `--color-policy-cyan-border`
- `--color-agent-violet`
- `--color-agent-violet-bg`
- `--color-agent-violet-border`

### verdict tokens
- `--color-verdict-go-*`
- `--color-verdict-hold-*`
- `--color-verdict-nogo-*`

## minimal primitives in scope
- card
- badge
- mono-label
- input
- button
- trace chip

## first proof surface
Apply the theme to the operator cockpit decision workflow pane before any full-shell restyle.

## implementation rules
- use app-managed font files for shipped paths and keep system stacks only as fallback; do not depend on remote font CSS for production behavior
- keep general UI states (`loading`, `error`, `empty`, `ok`, `stale`) visually distinct from verdict tokens
- keep pre-selection or pending workflow labels on neutral styling; only apply verdict tokens to actual `go` / `hold` / `no-go` meaning
- every implementation PR should include one reviewable proof artifact for the themed pane (rendered screenshot, before/after, or equivalent)
