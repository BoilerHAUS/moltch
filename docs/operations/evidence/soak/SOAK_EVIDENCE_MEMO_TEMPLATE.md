# soak evidence memo template

## metadata
- version: v1.0.0
- owner_role: agent_technical_delivery
- review_cadence: weekly
- next_review_due: 2026-03-21

## run identity
- run_id:
- generated_at_utc:
- environment: staging | preprod
- duration_hours:

## environment fingerprint
- web_image_tag:
- api_image_tag:
- source_commit_sha:
- config_hash:
- infra_context:

## observed metrics vs thresholds
| metric | observed | threshold | verdict |
|---|---:|---:|---|
| readiness success % |  | >= 99.0 | pass/fail |
| 5xx error rate % |  | <= 0.5 | pass/fail |
| p95 latency (ms) |  | <= 750 | pass/fail |
| sev2+ incidents |  | = 0 | pass/fail |

## abort gate evaluation
- gate_triggered: yes/no
- trigger_details:

## evidence links
- readiness_csv:
- readiness_summary_json:
- readiness_summary_md:
- logs_dashboard_link:

## decision statement
- decision: go | hold | no-go
- rationale:

## rollback/hold actions (if not go)
- action_1:
- action_2:

## counterfactual
- One metric change that would have flipped this decision:
