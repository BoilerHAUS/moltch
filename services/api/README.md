# services/api

Run locally:

```bash
cd services/api
npm start
```

Endpoints:
- `GET /health` -> 200
- `GET /ready` -> 200 in non-prod, or when `READY_TOKEN` is set
- `GET /sync/github` -> normalized open issues/PRs for one configured repo

`/sync/github` payload fields:
- `ok`
- `repo`
- `fetched_at`
- `items[]` with: `id`, `type` (`issue|pr`), `title`, `state`, `url`, `updated_at`, `assignee`

Failure object:
- `error.kind` in `auth|rate_limit|network`
- `error.message`
- `error.status`

Config:
- `PORT` (default `8080`)
- `NODE_ENV` (default `development`)
- `APP_NAME` (default `moltch-api`)
- `READY_TOKEN` (required for readiness in production)
- `GITHUB_SYNC_REPO` (default `BoilerHAUS/moltch`, format `owner/repo`)
- `GITHUB_SYNC_PER_PAGE` (default `25`, range `1..100`)
- `GITHUB_TOKEN` (optional; recommended to avoid strict anonymous limits)
