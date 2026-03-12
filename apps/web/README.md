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
