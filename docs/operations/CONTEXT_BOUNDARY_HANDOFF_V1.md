# context boundary handoff v1

## metadata
- version: v1.0.0
- owner_role: agent_technical_delivery
- review_cadence: weekly
- next_review_due: 2026-03-28

## objective
Define the first governed import/export contract for context crossing trust-zone boundaries in `BoilerHAUS/moltch`.

## scope
This slice defines:
- named trust zones for bounded memory domains
- deny-by-default import/export rules between those zones
- the minimum handoff artifact required for any cross-boundary transfer
- import handling states: `accepted_as_external_assertion`, `quarantined`, `rejected`
- quarantine/promotion rules that keep imported context from silently becoming shared truth

This slice does **not** attempt to solve:
- semantic truth-evaluation of agent output
- perfect poisoning detection
- trust scoring across agents/domains
- shared mutable memory semantics

## trust zones
Named v1 trust zones:
- `private_agent`
- `task_shared`
- `team_shared`
- `public_artifact`
- `quarantine`

Default boundary rules:
- no agent may read another domain directly
- no handoff may mutate the source domain in place
- no derived summary may cross a boundary without provenance + policy basis
- no imported context becomes native/shared truth merely because the handoff was accepted
- any promotion or re-export is itself a new governed boundary crossing

## classification model
Allowed context classifications for this slice:
- `agent_private`
- `task_scoped_internal`
- `team_internal`
- `public_publishable`

## crossing matrix (v1)
| source_domain | target_domain | allowed_classifications | default_decision |
|---|---|---|---|
| `private_agent` | `task_shared` | `task_scoped_internal` | allow via handoff artifact |
| `private_agent` | `team_shared` | none | deny by default |
| `private_agent` | `public_artifact` | none | deny by default |
| `task_shared` | `team_shared` | `team_internal` | require explicit policy basis |
| `task_shared` | `public_artifact` | `public_publishable` | require explicit policy basis |
| `team_shared` | `public_artifact` | `public_publishable` | require explicit policy basis |
| `*` | `quarantine` | any | allow for containment/audit |

Interpretation rules:
- any source/target/classification combination not named above is denied by default
- `quarantine` is a containment lane, not a normal collaboration lane
- acceptance into a target domain does not imply promotion to shared/native truth inside that domain

## minimum handoff artifact
Every boundary-crossing artifact must record:
- `artifact_version = context_boundary_handoff.v1`
- `generated_at_utc`
- `handoff_id`
- `trace_id`
- `source_domain`
- `target_domain`
- `sender`
- `receiver`
- `purpose`
- `classification`
- `policy_basis`
- `import_outcome`
- `content_summary`

Allowed `import_outcome` values:
- `accepted_as_external_assertion`
- `quarantined`
- `rejected`

## import-state rules
### accepted_as_external_assertion
- import may exist inside the receiver domain as attributed external context
- receiver may reference/use it locally
- receiver may **not** silently re-export it or widen trust scope
- receiver may **not** treat it as native/shared truth

### quarantined
- import is isolated from normal decision flow
- import remains inspectable and auditable through the quarantine path only
- quarantine review may later produce a new governed boundary-crossing event

### rejected
- import is denied from entering the target workflow path
- rejection attempt remains auditable

## promotion and re-export rule
Promotion from `accepted_as_external_assertion` or `quarantined` into a wider/shared trust zone requires a **new** handoff artifact with:
- a new `handoff_id`
- a new `trace_id` or linked parent trace
- explicit `policy_basis`
- explicit reviewer/operator-visible audit trail

For this v1 slice, the validator rejects `promoted_to_native_truth = true` in the same artifact that records the inbound handoff.

## quarantine rules
- quarantined artifacts live in the `quarantine` trust zone only
- quarantined artifacts are inspectable by authorized operators/reviewers, not treated as normal shared context
- any retry/promotion out of quarantine must be logged as a new governed event

## replay/failure scenarios (v1)
Minimum scenarios this slice should keep explicit:
1. valid import accepted as external assertion but not promoted
2. over-scoped import quarantined instead of entering shared flow
3. disallowed import rejected and logged
4. attempted re-export of imported context without a new policy check is denied
5. later promotion from quarantine/accepted state requires explicit review trail

## validator behavior
`scripts/ops/validate_context_boundary_handoff.py` must:
- validate the minimum handoff artifact fields
- reject unknown domains/classifications/outcomes
- reject any attempt to treat accepted inbound context as already promoted to native/shared truth
- reject deny-by-default source/target/classification combinations not listed in the v1 matrix
- allow quarantine as a containment sink for any classification

Fixture command:
`python3 scripts/ops/validate_context_boundary_handoff.py --input scripts/ops/fixtures/context_boundary/handoff_valid_v1.json`

## integration notes
- `docs/README.md` should index this contract.
- `scripts/docs/check_docs.sh` should validate one passing fixture and two failing fixtures for the v1 handoff rules.
- later runtime implementation may consume this contract, but this slice stays artifact/validation-first.
