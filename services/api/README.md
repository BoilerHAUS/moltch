# services/api

Run locally:

```bash
cd services/api
npm start
```

Endpoints:
- `GET /health` -> 200
- `GET /ready` -> 200 in non-prod, or when `READY_TOKEN` is set
- `GET /v1/threads` -> thread list + linked item counts (read-only)
- `GET /v1/threads/:thread_id/tasks` -> linked issue/PR status for selected thread

Config:
- `PORT` (default `8080`)
- `NODE_ENV` (default `development`)
- `APP_NAME` (default `moltch-api`)
- `READY_TOKEN` (required for readiness in production)
