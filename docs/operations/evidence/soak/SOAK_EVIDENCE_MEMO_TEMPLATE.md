# soak evidence memo template

## metadata
- version: v1.1.0
- owner_role: agent_technical_delivery
- review_cadence: weekly
- next_review_due: 2026-03-21

## run identity
- run_id:
- generated_at_utc:
- environment: staging | preprod
- duration_hours:
- sample_window_start_utc:
- sample_window_end_utc:

## environment fingerprint
- web_image_tag:
- api_image_tag:
- source_commit_sha:
- config_hash:
- infra_context:

## environment fidelity checklist
| item | status | notes |
|---|---|---|
| same deploy topology class | pass/fail | |
| same image family/tag strategy | pass/fail | |
| equivalent config profile | pass/fail | |
| equivalent backing service versions | pass/fail | |
| equivalent autoscaling policy class | pass/fail | |
| equivalent observability coverage | pass/fail | |

- fidelity_score: X/6

## observed metrics vs thresholds
| metric | observed | threshold | verdict | data_source | window |
|---|---:|---:|---|---|---|
| readiness success % |  | >= 99.0 | pass/fail | query/path | start..end |
| 5xx error rate % |  | <= 0.5 | pass/fail | query/path | rolling 60m |
| p95 latency (ms) |  | <= 750 | pass/fail | query/path | rolling 15m |
| sev2+ incidents |  | = 0 | pass/fail | incident feed/path | full window |

## abort gate evaluation
- gate_triggered: yes/no
- trigger_details:
- remediation_applied_during_run: yes/no

## evidence links
- readiness_csv:
- readiness_summary_json:
- readiness_summary_md:
- logs_dashboard_link:
- hold_path_dry_run_artifact:

## decision statement
- decision: go | hold | no-go
- rationale:
- consistency_rule_applied:

## rollback/hold actions (if not go)
- action_1:
- action_2:

## counterfactual
- One metric change that would have flipped this decision:
