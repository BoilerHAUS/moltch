# decision loop simulation report

- suite_version: v1.0.0
- seed: issue-166-decision-loop-v1
- generated_at_utc: 2026-03-18T00:00:00Z
- registry_version: v1.3.0
- total_scenarios: 5

## scenario matrix
| scenario_id | final_state | launch_decision | reason_code | trace_events |
|---|---|---|---|---|
| happy-path-go | recorded | go | executed | 4 |
| human-hold | recorded | hold | blocked_needs_human | 4 |
| deny-permission | recorded | no_go | permission_denied | 4 |
| timeout-hold | recorded | hold | validation_failed | 4 |
| retry-recovers-to-go | recorded | go | executed | 4 |

## trace highlights
### happy-path-go
- correlation_id: `corr-happy-path-go-8e60b0b392`
- decision_id: `dec-5301e8ecf260`
- transitions: requested->evaluating -> evaluating->go -> go->recorded
- launch: **go** (executed)
  - 2026-03-18T00:00:00Z :: issue_ingest :: received :: state=requested :: reason=n/a
  - 2026-03-18T00:01:00Z :: policy_decision :: allow :: state=evaluating :: reason=executed
  - 2026-03-18T00:02:00Z :: evidence_validation :: pass :: state=evaluating :: reason=executed
  - 2026-03-18T00:03:00Z :: launch_verdict :: go :: state=go :: reason=executed

### human-hold
- correlation_id: `corr-human-hold-fb56bf520d`
- decision_id: `dec-222935fcc26a`
- transitions: requested->evaluating -> evaluating->hold -> hold->recorded
- launch: **hold** (blocked_needs_human)
  - 2026-03-18T00:00:00Z :: issue_ingest :: received :: state=requested :: reason=n/a
  - 2026-03-18T00:01:00Z :: policy_decision :: blocked_needs_human :: state=evaluating :: reason=blocked_needs_human
  - 2026-03-18T00:02:00Z :: evidence_validation :: skipped :: state=evaluating :: reason=n/a
  - 2026-03-18T00:03:00Z :: launch_verdict :: hold :: state=hold :: reason=blocked_needs_human

### deny-permission
- correlation_id: `corr-deny-permission-6b2644977e`
- decision_id: `dec-8840074a776a`
- transitions: requested->evaluating -> evaluating->no_go -> no_go->recorded
- launch: **no_go** (permission_denied)
  - 2026-03-18T00:00:00Z :: issue_ingest :: received :: state=requested :: reason=n/a
  - 2026-03-18T00:01:00Z :: policy_decision :: deny :: state=evaluating :: reason=permission_denied
  - 2026-03-18T00:02:00Z :: evidence_validation :: skipped :: state=evaluating :: reason=n/a
  - 2026-03-18T00:03:00Z :: launch_verdict :: no_go :: state=no_go :: reason=permission_denied

### timeout-hold
- correlation_id: `corr-timeout-hold-5730d7e3b7`
- decision_id: `dec-25157cc1238b`
- transitions: requested->evaluating -> evaluating->hold -> hold->recorded
- launch: **hold** (validation_failed)
  - 2026-03-18T00:00:00Z :: issue_ingest :: received :: state=requested :: reason=n/a
  - 2026-03-18T00:01:00Z :: policy_decision :: allow :: state=evaluating :: reason=executed
  - 2026-03-18T00:02:00Z :: evidence_validation :: timeout :: state=evaluating :: reason=validation_failed
  - 2026-03-18T00:03:00Z :: launch_verdict :: hold :: state=hold :: reason=validation_failed

### retry-recovers-to-go
- correlation_id: `corr-retry-recovers-to-go-6d2a8ab923`
- decision_id: `dec-eecca362121d`
- transitions: requested->evaluating -> evaluating->go -> go->recorded
- launch: **go** (executed)
  - 2026-03-18T00:00:00Z :: issue_ingest :: received :: state=requested :: reason=n/a
  - 2026-03-18T00:01:00Z :: policy_decision :: allow :: state=evaluating :: reason=executed
  - 2026-03-18T00:02:00Z :: evidence_validation :: pass_after_retry :: state=evaluating :: reason=executed
  - 2026-03-18T00:03:00Z :: launch_verdict :: go :: state=go :: reason=executed

