# @moltch/policy-engine

Canonical policy-decision state machine + reason-code registry enforcement for issues #163/#164, with migration/lifecycle tooling for #171.

## Run

```bash
cd packages/policy-engine
npm run check
```

`npm run check` includes:
- deterministic decision-loop simulation verification against:
  - `packages/policy-engine/fixtures/decision-loop-scenarios.v1.json`
  - `packages/policy-engine/artifacts/decision-loop-simulation.report.json`
  - `packages/policy-engine/artifacts/decision-loop-simulation.report.md`
- reason-code drift validation against:
  - `packages/policy-engine/data/reason-code-registry.v1.json`
  - `docs/governance/POLICY_DECISION_REASON_CODE_CATALOG_V1_2.md`
- migration/replay compatibility validation against:
  - `packages/policy-engine/data/reason-code-migration-map.v1.json`
  - `docs/governance/fixtures/policy_reason_code_replay_compat_v1.json`

To regenerate the simulation artifacts after an intentional decision-path change:

```bash
cd packages/policy-engine
npm run build:simulation
```

## Public API

- `createDecisionContext(input)`
- `applyTransition(currentState, nextState, context)`
- `replayDecisionHistory(events, initialState?)`
- reason-code registry helpers:
  - `loadReasonCodeRegistry(pathOrUrl?)`
  - `validateRegistryShape(registry)`
  - `buildReasonCodeIndex(registry)`
  - `assertReasonCodeAllowed(reasonCode, index, options?)`
- reason-code migration helpers:
  - `loadReasonCodeMigrationMap(pathOrUrl?)`
  - `validateMigrationMapShape(map)`
  - `resolveReasonCodeLifecycle(reasonCode, options?)`
  - `buildMigrationReport(records, options?)`
- constants: `DecisionState`, `TERMINAL_STATES`, `TRANSITION_ERROR`, `REASON_CODE_ERROR`, `REASON_CODE_MIGRATION_ERROR`
- identity + attestation helpers:
  - `validateActorIdentitySchema(schema)`
  - `buildActorIdentityIndex(schema)`
  - `canonicalizeForSignature(value)`
  - `signAttestationEnvelope(unsignedEnvelope, options)`
  - `verifyAttestationEnvelope(envelope, options)`
- constants: `ATTESTATION_ERROR`
