# staging edge routing + tls baseline

## metadata
- version: v1.0.1
- owner_role: agent_technical_delivery
- review_cadence: biweekly
- next_review_due: 2026-03-22

## goal
Provide a reproducible staging edge layer with HTTPS termination and deterministic routing.

## topology
- `edge` (Caddy) terminates TLS
- `/api/*` -> `api:8080`
- all other paths -> `web:3000`

## files
- `docker-compose.staging.yml` (web/api services)
- `docker-compose.staging.edge.yml` (edge service)
- `infra/environments/staging/Caddyfile` (routing + TLS)

## required env
Add to `infra/environments/staging/.env.staging`:

```bash
# edge + DNS
STAGING_WEB_DOMAIN=staging.example.com
ACME_EMAIL=ops@example.com

# optional edge port remap (defaults shown)
EDGE_HTTP_PORT=80
EDGE_HTTPS_PORT=443
```

## dns requirements
- point `STAGING_WEB_DOMAIN` A/AAAA records to the staging host
- ensure ports `80` and `443` are reachable for certificate issuance/renewal

## external exposure posture (recommended)
- expose only `edge` externally (`80/443`)
- keep direct web/api service ports for internal operations only when possible
- if direct ports remain published, restrict with host firewall rules (allow trusted IPs only)

## deploy
From repo root:

```bash
docker compose \
  --env-file infra/environments/staging/.env.staging \
  -f docker-compose.staging.yml \
  -f docker-compose.staging.edge.yml \
  up -d --build
```

## validation
```bash
# web over tls
curl -I https://${STAGING_WEB_DOMAIN}

# api path via edge
curl -sS https://${STAGING_WEB_DOMAIN}/api/health
curl -sS https://${STAGING_WEB_DOMAIN}/api/ready
```

Expected:
- HTTPS responses are successful
- `/api/health` returns service health payload
- `/api/ready` returns readiness payload

## rollback to direct-port mode
Disable edge and keep web/api live directly:

```bash
docker compose \
  --env-file infra/environments/staging/.env.staging \
  -f docker-compose.staging.yml \
  -f docker-compose.staging.edge.yml \
  stop edge
```

(optional) remove edge container:
```bash
docker compose \
  --env-file infra/environments/staging/.env.staging \
  -f docker-compose.staging.yml \
  -f docker-compose.staging.edge.yml \
  rm -f edge
```

## certificate issuance troubleshooting
- DNS not propagated yet: verify `A/AAAA` records resolve to staging host before first deploy
- firewall/network blocks: verify inbound `80` and `443` are reachable from internet
- ACME rate limits: avoid repeated failing issuance loops; fix DNS/firewall first, then retry
- check edge logs for certificate events:
```bash
docker compose --env-file infra/environments/staging/.env.staging -f docker-compose.staging.yml -f docker-compose.staging.edge.yml logs edge --tail=200
```

## notes
- for local/private non-public staging, you can use Caddy internal certs by replacing site address with `:443` and adding `tls internal` in Caddyfile.
- baseline security headers are set at edge (`X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`).
- production hardening (WAF, stricter headers, rate limits) should be added separately.
