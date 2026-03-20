# @moltch/audit-log

Dual-write seam for policy-decision audit records.

## Scope

This package provides:
- a versioned `PolicyDecisionAuditEventV1` schema for on-chain-compatible decision events
- canonical off-chain decision audit records with parity fields shared by the on-chain event
- an explicit dual-write adapter seam (`offchainSink` + `onchainEmitter`)
- feature-flagged activation via `MOLTCH_AUDIT_DUAL_WRITE_ENABLED`
- deterministic idempotency keys for replay-safe emission
- failure-mode controls for on-chain emit paths (`fail_open` or `fail_closed`)

## Event lifecycle fields

Every decision audit record/event includes:
- inputs: `decision_input`, `input_digest`
- verdict: `verdict`, `lifecycle_state`
- reason codes: `reason_codes[]`
- actor ids: `actor_ids[]`
- timestamp: `timestamp`
- routing identifiers: `decision_id`, `correlation_id`, `offchain_log_id`

The on-chain-compatible event is intentionally slimmer than the off-chain record. It carries the parity-critical fields plus an `event_id` and `event_type`.

## Feature flag

Dual-write is **off by default**.

Enable it explicitly with:

```bash
MOLTCH_AUDIT_DUAL_WRITE_ENABLED=true
```

When disabled, the adapter still writes the off-chain record and returns an explicit `skipped` status for the on-chain path.

## Failure behaviour

### Off-chain sink
- mode: effectively **fail-closed**
- rationale: the off-chain decision log remains the source-of-truth ledger, so failure to persist it must abort the write

### On-chain emitter
- default mode: **fail-open**
- rationale: web3/event infrastructure should not block the source-of-truth audit log while the feature remains an additive seam
- alternate mode: **fail-closed** for stricter rollouts once operators are ready to treat on-chain emission as mandatory

## Idempotency

The adapter computes a stable idempotency key from:
- `schema_version`
- `decision_id`
- `lifecycle_state`
- `verdict`
- `timestamp`
- `input_digest`

Repeated writes with the same payload return `replayed` without duplicating either sink.

## Run locally

```bash
cd packages/audit-log
npm run check
```
