# production-like soak validation plan (2026-03)

## metadata
- version: v1.0.0
- owner_role: agent_technical_delivery
- review_cadence: weekly
- next_review_due: 2026-03-21

## objective
Validate operational durability before wider launch exposure using a predeclared, fail-closed soak process.

## scope
- target window: 24h minimum, extendable to 72h when risk profile is elevated
- environment: staging or preprod mirror with production-like config
- traffic mode: synthetic + controlled real workflow simulation

## predeclared thresholds
| metric | threshold | fail condition |
|---|---|---|
| readiness success % | >= 99.0% | below 99.0% over full window |
| 5xx error rate | <= 0.5% | above 0.5% in any 60m rolling window |
| p95 latency | <= 750 ms | above 750 ms for 3 consecutive 15m intervals |
| incident count (sev2+) | 0 | any sev2+ during soak |

## abort gates (hard stop)
Abort soak and set provisional `hold` if any of the following triggers fire:
1. readiness drops below 98.0% for 2 consecutive 15m intervals
2. 5xx error rate exceeds 1.0% in any 30m rolling window
3. p95 latency exceeds 1000 ms for 2 consecutive 15m intervals
4. sev2+ incident declared

## environment fingerprint requirements
Capture and store in evidence memo:
- image tags / commit SHAs for all deployed services
- runtime configuration version/hash
- infra context (region, node/pool, backing service versions)

## sampling and artifact outputs
- probe cadence: every 300 seconds
- required artifacts:
  - readiness raw CSV + summary JSON/MD
  - soak evidence memo (use template at `docs/operations/evidence/soak/SOAK_EVIDENCE_MEMO_TEMPLATE.md`)
  - threshold comparison table (observed vs target)

## decision rubric
Final outcome must be one of:
- `go`: all thresholds satisfied, no abort gates, no unresolved sev2+
- `hold`: no hard incident but one or more thresholds missed or confidence incomplete
- `no-go`: abort gate triggered or severe reliability breach observed

## rollback / hold actions
- pin to last known-good image set
- stop promotion pipeline
- open `needs-human` issue with root-cause hypotheses + mitigation options
- rerun soak only after remediation evidence is attached

## counterfactual requirement
Every evidence memo must include one counterfactual statement:
- what single metric outcome would have changed the final decision state
