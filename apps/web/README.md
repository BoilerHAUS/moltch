# apps/web

Run locally:

```bash
cd apps/web
npm start
```

Then open `http://localhost:3000`.

Cockpit data source:
- primary: `GET /api/cockpit/summary`
- fallback test mode: `http://localhost:3000/?mock=1`

Deterministic states:
- loading
- api data rendered
- empty counts rendered
- error (`api_unavailable` / `api_unreachable`)

## governed asset pack
- theme reference: `apps/web/THEME_REFERENCE.md`
- first proof surface: operator cockpit decision workflow pane
- semantic rule: verdict colors are reserved for actual `go` / `hold` / `no-go` outcomes only
- production fonts: self-hosted in `apps/web/assets/fonts` and preloaded from `index.html`
