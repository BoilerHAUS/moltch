# decision parity validation v1

## metadata
- version: v1.0.0
- owner_role: agent_technical_delivery
- review_cadence: weekly
- next_review_due: 2026-03-28

## objective
Define the first canonical parity-validation contract between off-chain decision records and candidate on-chain decision event payloads so semantic equivalence can be checked deterministically before web3/runtime promotion.

## scope
This slice defines:
- normalized semantic parity rules
- required vs optional parity keys
- mismatch classification taxonomy
- risk/lane-based fail behavior
- validator artifact expectations

This slice does **not** define:
- on-chain emitter implementation
- transport/wallet wiring
- adaptive mismatch suppression

## dependencies
- decision event schema: `docs/operations/DECISION_EVENT_SCHEMA_V1.md`
- decision alert contract: `docs/operations/DECISION_ALERT_CONTRACT_V1.md`
- issue lineage / correlation discipline from observability lanes

## parity model
Parity is evaluated as **normalized semantic parity**, not raw structural identity.

Meaning:
- field ordering differences are ignored
- optional metadata may differ without failing parity
- required decision meaning must remain equivalent after normalization

## required parity keys
The validator must compare these keys after normalization:
- `decision_id`
- `correlation_id`
- `lineage_id`
- `from_state`
- `to_state`
- `result`
- `reason_code`
- `lane`
- `risk_class`

## optional keys
The following may differ without failing parity if required meaning remains equivalent:
- `metadata`
- `notes`
- `extra_context`
- non-canonical field ordering
- representational encoding differences already absorbed by normalization

## normalization rules
- treat object key ordering as irrelevant
- normalize verdict spelling to canonical event result values (`success`, `hold`, `no_go`, `error`)
- normalize missing optional metadata to empty object
- trim surrounding whitespace on compared string values
- numeric and boolean threshold/config metadata outside required parity keys does not affect semantic parity in this slice

## mismatch classification taxonomy
Validator output must classify mismatches as one of:
- `missing_required_field`
- `lineage_correlation_mismatch`
- `state_transition_mismatch`
- `verdict_reason_mismatch`
- `lane_risk_mismatch`

## fail behavior by lane/risk
- `launch-gate` lane or `treasury-critical` risk class -> **fail-closed** on any parity mismatch
- lower-risk shadow/observability lanes -> **fail-open** with mandatory alert/evidence record
- pass behavior must still emit deterministic evidence artifact for review

## validator artifact requirement
Validator must be able to write deterministic review artifacts:
- JSON summary
- markdown summary

Required outputs include:
- normalized comparison payloads
- parity verdict (`pass` | `fail_open` | `fail_closed`)
- mismatch classifications
- fail behavior rationale

## fixture requirements
At minimum include fixtures for:
1. strict match (pass)
2. semantically equivalent but structurally different payload (pass)
3. lineage/correlation mismatch (fail)
4. verdict/reason mismatch (fail)
5. missing required field (fail)

## integration notes
- this slice is contract + validator first
- later web3 lanes may consume the same normalized parity rules for real event emission and bridge proofs
