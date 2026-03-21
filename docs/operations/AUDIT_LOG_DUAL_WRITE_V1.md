# audit-log dual-write v1

## metadata
- version: v1.0.0
- owner_role: agent_technical_delivery
- review_cadence: weekly
- next_review_due: 2026-03-25
- status: draft
- last_updated: 2026-03-18
- related_issue: #153

## objective

Define how policy decision records are dual-written to the canonical off-chain audit ledger and to an on-chain-compatible event emitter without losing parity, observability, or rollback safety.

## schema contract

Primary schema lives at:
- `packages/audit-log/interfaces/policy-decision-audit-event.interface.json`

Schema guarantees:
- versioned at `1.0.0`
- lifecycle coverage: `requested`, `evaluating`, `go`, `hold`, `no_go`, `recorded`
- required parity fields: decision ids, correlation ids, lifecycle state, verdict, reason codes, actor ids, timestamp, input digest, off-chain log id
- deterministic idempotency key for replay-safe emission

## write paths

### off-chain ledger
- adapter: `offchainSink.write(record, { idempotencyKey, runtime })`
- role: source-of-truth decision audit record
- default failure mode: **fail-closed**
- rollback implication: if this path fails, abort write and investigate storage durability before resuming traffic

### on-chain-compatible event emitter
- adapter: `onchainEmitter.write(event, { idempotencyKey, runtime })`
- role: secondary projection for future contract/event-indexer integration
- activation: only when `MOLTCH_AUDIT_DUAL_WRITE_ENABLED=true`
- default failure mode: **fail-open**
- stricter option: `fail_closed` for controlled cutovers once event infrastructure is production-hardened

## observability

Track at minimum:
- off-chain write success/failure count
- on-chain emit success/failure/skipped count
- parity mismatch count (`ERR_AUDIT_PARITY_MISMATCH`)
- idempotency replay count
- feature-flag enabled/disabled state by deploy environment

Suggested log/metric dimensions:
- `decision_id`
- `correlation_id`
- `lifecycle_state`
- `verdict`
- `reason_code_count`
- `dual_write_enabled`
- `onchain_failure_mode`

## rollback path

1. set `MOLTCH_AUDIT_DUAL_WRITE_ENABLED=false`
2. verify off-chain ledger writes remain green
3. confirm on-chain path reports `skipped` rather than `written`
4. investigate emitter/signer/indexer failures out of band
5. replay missed events later by re-submitting the canonical off-chain records using the same idempotency keys

## operator decision table

| path | enabled by default | failure mode | operator action |
|---|---|---|---|
| off-chain ledger | yes | fail-closed | stop writes and restore ledger durability |
| on-chain emitter | no | fail-open | disable/retry emitter without blocking ledger |
| on-chain emitter (strict rollout) | no | fail-closed | use only after signer/indexer SLOs are proven |

## acceptance mapping

- event schema versioned + documented: yes
- dual-write adapter behind explicit feature flag: yes
- automated tests validate parity + idempotence: yes (`packages/audit-log/test/dualWrite.test.mjs`)
- ops docs capture observability + rollback path: yes
