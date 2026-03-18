# @moltch/contracts

Deterministic seam contracts for policy decisions and the oracle bridge approval/execution flow.

## Scope

This package defines:
- interface-level contract boundaries for `request -> evaluate -> verdict -> record`
- interface-level contract boundaries for `bridge request -> on-chain approval -> execution result -> reconciliation`
- stage-specific required fields for decision and oracle bridge seams
- stable reason-code taxonomy hooks
- invariant tests for deterministic, replayable behavior
- reproducible artifact generation with checksums

## Run locally

```bash
cd packages/contracts
npm run check
```

## Outputs

`npm run build` generates:
- `artifacts/policy-decision-seam.artifact.json`
- `artifacts/oracle-bridge-seam.artifact.json`
- `artifacts/checksums.sha256`

Both outputs are deterministic for unchanged interface inputs.
