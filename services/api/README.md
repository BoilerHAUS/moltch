# services/api

Run locally:

```bash
cd services/api
npm start
```

Endpoints:
- `GET /health` -> 200
- `GET /ready` -> 200 in non-prod, or when `READY_TOKEN` is set

Config:
- `PORT` (default `8080`)
- `NODE_ENV` (default `development`)
- `APP_NAME` (default `moltch-api`)
- `READY_TOKEN` (required for readiness in production)
