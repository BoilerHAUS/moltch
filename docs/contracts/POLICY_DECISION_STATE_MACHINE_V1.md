# Policy Decision State Machine V1

## Purpose

Defines the canonical, deterministic decision path for policy decisions in moltch.

## States

- `requested`
- `evaluating`
- `go`
- `hold`
- `no_go`
- `recorded`

## Transition Diagram

```text
requested -> evaluating -> {go | hold | no_go} -> recorded
```

## Transition Table

| From | Allowed To |
| --- | --- |
| requested | evaluating |
| evaluating | go, hold, no_go |
| go | recorded |
| hold | recorded |
| no_go | recorded |
| recorded | (none) |

## Required Context Fields

For all transitions:
- `decisionId`
- `correlationId`
- `actor`

For `evaluating -> {go|hold|no_go}` additionally:
- `reasonCode` (must exist in active reason-code registry)

## Deterministic Error Codes

- `ERR_INVALID_STATE`
- `ERR_INVALID_TRANSITION`
- `ERR_REQUIRED_FIELDS_MISSING`
- `ERR_REPLAY_EVENT_INVALID`
- `ERR_REPLAY_MISMATCH`
- `ERR_REASON_CODE_REGISTRY_INVALID`
- `ERR_REASON_CODE_UNKNOWN`
- `ERR_REASON_CODE_DEPRECATED`
- `ERR_REASON_CODE_REMOVED`

## Related policy docs
- reason code lifecycle policy: `docs/governance/REASON_CODE_LIFECYCLE_POLICY_V1.md`
