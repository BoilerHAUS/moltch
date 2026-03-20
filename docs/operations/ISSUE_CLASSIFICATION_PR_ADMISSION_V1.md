# issue classification and pr admission v1

## metadata
- version: v1.0.0
- owner_role: agent_technical_delivery
- review_cadence: weekly
- next_review_due: 2026-03-28

## objective
Define the first governed contract for issue classification and admission to the PR lane so active delivery is explicit, auditable, and not inferred from the mere existence of a PR.

## scope
This contract applies after canonical roadmap reconciliation has established whether an issue is:
- roadmap-tracked in `docs/product/ROADMAP_V1.md`
- intentionally excluded in the canonical exclusion artifact

This contract does not replace roadmap/open-issue reconciliation. It layers on top of it.

## canonical sources of truth
- roadmap tracking truth: `docs/product/ROADMAP_V1.md`
- canonical exclusion artifact: `docs/product/ROADMAP_V1.md` section `## excluded issues (optional)`
- active-delivery admission record: explicit issue-classification artifact validated by `scripts/ops/validate_issue_classification.py`

## operating principles
- Issue classification and PR-lane admission are separate decisions.
- A PR URL or open PR does not prove readiness.
- Auto-classification must stay conservative.
- Active delivery requires an explicit admission decision with a recorded basis.
- Reconciliation artifacts remain reporting and validation surfaces; they do not auto-edit roadmap semantics.

## explicit classification state machine
### states
- `planned`: issue is roadmap-tracked but not admitted to the PR lane
- `active_delivery_candidate`: issue is being considered for delivery, but admission is not yet granted
- `active_delivery`: issue is explicitly admitted to active delivery
- `excluded`: issue is intentionally outside the roadmap lane and must stay outside the PR lane

### allowed transitions
- `planned` -> `active_delivery_candidate`
- `active_delivery_candidate` -> `planned`
- `active_delivery_candidate` -> `active_delivery`
- `active_delivery` -> `active_delivery_candidate`
- `planned` -> `excluded` only after the roadmap row is removed and the canonical exclusion artifact is updated
- `excluded` -> `planned` only after the exclusion entry is removed and a canonical roadmap row is added

Transition guardrails:
- no state may bypass roadmap truth
- `active_delivery` may only be reached through an explicit manual admission record
- automation may classify only `planned` from roadmap truth or `excluded` from the canonical exclusion artifact

## admission-control contract for active delivery
An issue may enter `active_delivery` only when all are explicitly recorded:
- `pr_admission.status = admitted`
- `pr_admission.ready_for_pr = true`
- `pr_admission.basis` explains why the issue is ready for implementation/review
- `pr_admission.decided_by` names the accountable decider
- `pr_admission.decided_at_utc` records when admission happened

Non-admitted variants:
- `planned` must use `pr_admission.status = not_admitted`
- `active_delivery_candidate` may use `not_admitted` or `blocked`
- `excluded` must use `not_admitted`

Important distinction:
- classification answers "what lane-state is this issue in?"
- admission answers "is this issue allowed into the PR lane right now?"

## explicit artifact contract
The validating artifact is JSON with:
- `artifact_version = issue_classification_status.v1`
- `generated_at_utc`
- `issues[]`

Each issue record must contain:
- `issue_number`
- `classification.state`
- `classification.source`: `auto_roadmap` | `auto_exclusion` | `manual`
- `classification.rationale`
- `pr_admission.status`: `not_admitted` | `blocked` | `admitted`
- `pr_admission.ready_for_pr`
- optional `pull_request_url`

State-specific rules:
- `planned`:
  - must be backed by a canonical roadmap row
  - must remain `not_admitted`
- `active_delivery_candidate`:
  - must be backed by a canonical roadmap row
  - must be `manual`
  - may be `blocked`, but not `ready_for_pr`
- `active_delivery`:
  - must be backed by a canonical roadmap row
  - must be `manual`
  - must be explicitly `admitted`
- `excluded`:
  - must be backed by the canonical exclusion artifact
  - must not carry PR-lane admission fields or PR URLs

## validator behavior
`scripts/ops/validate_issue_classification.py` must:
- read roadmap mapping and exclusion truth from `docs/product/ROADMAP_V1.md` or a fixture equivalent
- validate explicit classification/admission JSON without using network calls
- reject any attempt to infer readiness from `pull_request_url`
- reject any automatic promotion into `active_delivery`
- fail when a record disagrees with the roadmap mapping or exclusion artifact

Fixture command:
`python3 scripts/ops/validate_issue_classification.py --roadmap scripts/ops/fixtures/issue_classification/ROADMAP_V1.fixture.md --input scripts/ops/fixtures/issue_classification/issue_classification_status_valid_v1.json`

## integration notes
- Use `docs/operations/ROADMAP_OPEN_ISSUE_RECONCILIATION_V1.md` to verify tracking/exclusion coverage.
- Use this contract to validate explicit classification/admission records after coverage is already in place.
- PR templates and review notes should capture classification state and PR-lane admission basis when the issue is in active delivery.
