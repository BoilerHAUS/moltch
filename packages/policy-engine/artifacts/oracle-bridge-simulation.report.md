# oracle bridge simulation report

- suite_version: v1.0.0
- seed: issue-155-oracle-bridge-v1
- generated_at_utc: 2026-03-18T00:00:00Z
- total_scenarios: 3

## scenario matrix
| scenario_id | final_state | trace_events |
|---|---|---|
| approve-execute-success | reconciled | 5 |
| deny-on-chain | reconciled | 3 |
| timeout-then-reconcile | reconciled | 3 |

## trace highlights
### approve-execute-success
- correlation_id: `corr-approve-execute-success-749656501f`
- bridge_request_id: `obr-approve-execute-success-ad34c22e54`
- decision_id: `dec-77349ced0b7c`
- transitions: requested->approval_pending -> approval_pending->approved -> approved->executing -> executing->executed -> executed->reconciled
  - 2026-03-18T00:00:00Z :: bridge_request :: submitted :: state=approval_pending :: approval=n/a :: execution=n/a
  - 2026-03-18T00:01:00Z :: bridge_approval :: approved :: state=approved :: approval=apr-success-1 :: execution=n/a
  - 2026-03-18T00:02:00Z :: bridge_execution :: started :: state=executing :: approval=apr-success-1 :: execution=n/a
  - 2026-03-18T00:03:00Z :: bridge_result :: executed :: state=executed :: approval=apr-success-1 :: execution=exe-success-1
  - 2026-03-18T00:04:00Z :: bridge_reconcile :: reconciled :: state=reconciled :: approval=apr-success-1 :: execution=exe-success-1

### deny-on-chain
- correlation_id: `corr-deny-on-chain-44b0631d4a`
- bridge_request_id: `obr-deny-on-chain-124d68f531`
- decision_id: `dec-f60c3a2e7c41`
- transitions: requested->approval_pending -> approval_pending->denied -> denied->reconciled
  - 2026-03-18T00:00:00Z :: bridge_request :: submitted :: state=approval_pending :: approval=n/a :: execution=n/a
  - 2026-03-18T00:01:00Z :: bridge_approval :: denied :: state=denied :: approval=n/a :: execution=n/a
  - 2026-03-18T00:02:00Z :: bridge_reconcile :: reconciled :: state=reconciled :: approval=n/a :: execution=n/a

### timeout-then-reconcile
- correlation_id: `corr-timeout-then-reconcile-78b10fb926`
- bridge_request_id: `obr-timeout-then-reconcile-03843ee214`
- decision_id: `dec-20f06ab27345`
- transitions: requested->approval_pending -> approval_pending->timed_out -> timed_out->reconciled
  - 2026-03-18T00:00:00Z :: bridge_request :: submitted :: state=approval_pending :: approval=n/a :: execution=n/a
  - 2026-03-18T00:01:00Z :: bridge_timeout :: timeout :: state=timed_out :: approval=n/a :: execution=n/a
  - 2026-03-18T00:02:00Z :: bridge_reconcile :: reconciled :: state=reconciled :: approval=n/a :: execution=n/a

