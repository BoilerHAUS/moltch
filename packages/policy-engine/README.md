# @moltch/policy-engine

Canonical policy-decision state machine + reason-code registry enforcement for issues #163/#164.

## Run

```bash
cd packages/policy-engine
npm run check
```

`npm run check` includes reason-code drift validation against:
- `packages/policy-engine/data/reason-code-registry.v1.json`
- `docs/governance/POLICY_DECISION_REASON_CODE_CATALOG_V1_2.md`

## Public API

- `createDecisionContext(input)`
- `applyTransition(currentState, nextState, context)`
- `replayDecisionHistory(events, initialState?)`
- reason-code registry helpers:
  - `loadReasonCodeRegistry(pathOrUrl?)`
  - `validateRegistryShape(registry)`
  - `buildReasonCodeIndex(registry)`
  - `assertReasonCodeAllowed(reasonCode, index, options?)`
- constants: `DecisionState`, `TERMINAL_STATES`, `TRANSITION_ERROR`, `REASON_CODE_ERROR`
