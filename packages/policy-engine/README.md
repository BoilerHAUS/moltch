# @moltch/policy-engine

Canonical policy-decision state machine implementation for issue #163.

## Run

```bash
cd packages/policy-engine
npm run check
```

## Public API

- `createDecisionContext(input)`
- `applyTransition(currentState, nextState, context)`
- `replayDecisionHistory(events, initialState?)`
- constants: `DecisionState`, `TERMINAL_STATES`, `TRANSITION_ERROR`
