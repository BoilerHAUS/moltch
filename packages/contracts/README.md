# @moltch/contracts

First-pass `packages/contracts` foundation for the policy-decision seam.

## Scope

This package defines:
- interface-level contract boundaries for `request -> evaluate -> verdict -> record`
- stage-specific required fields (`requestRequiredFields`, `evaluationRequiredFields`)
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
- `artifacts/checksums.sha256`

Both outputs are deterministic for unchanged interface inputs.
