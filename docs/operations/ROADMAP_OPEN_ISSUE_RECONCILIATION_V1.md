# roadmap open-issue reconciliation v1

## metadata
- version: v1.0.0
- owner_role: agent_technical_delivery
- review_cadence: weekly
- next_review_due: 2026-03-27

## objective
Define the first shippable slice of deterministic roadmap/open-issue reconciliation for `BoilerHAUS/moltch`.

## scope
This slice reconciles only the canonical open-issue mapping in `docs/product/ROADMAP_V1.md` against:
- live GitHub open issues for one repo, or
- a deterministic fixture payload passed to the reconciler.

The output is evidence-first:
- immutable JSON artifact,
- immutable Markdown artifact,
- explicit pre-merge vs post-merge action classification,
- zero semantic auto-edits to roadmap/governance policy content.

## single source of truth
For this slice, the only repo-owned source of truth is:
- `docs/product/ROADMAP_V1.md`

Within that file, only these sections are in scope:
- `## open issues mapping (canonical)`
- `## excluded issues (optional)`

## trigger modes
### pre-merge
Use `--trigger-mode pre-merge` while validating a PR branch.

Action classification meaning:
- `block_merge`: the branch must not merge until the mapping drift is repaired in the same PR.
- `no_action`: the issue is cleanly mapped or intentionally excluded.

### post-merge
Use `--trigger-mode post-merge` after merge reconciliation.

Action classification meaning:
- `post_merge_follow_up`: merge happened, but roadmap/exclusion cleanup still must land within 24h per `docs/product/ROADMAP_V1.md`.
- `no_action`: the issue is cleanly mapped or intentionally excluded.

## drift classes
- `missing_open_issue_tracking`: open issue is neither mapped nor excluded.
- `duplicate_mapping_rows`: same open issue appears more than once in the mapping table.
- `duplicate_exclusion_entries`: same open issue appears more than once in excluded issues.
- `overlap_mapped_and_excluded`: same open issue appears in both canonical locations.
- `stale_mapping_closed_issue`: mapping table still points at a non-open issue.
- `stale_exclusion_closed_issue`: excluded list still points at a non-open issue.

## no-touch zones
This reconciler is intentionally mechanical. It must not auto-edit:
- roadmap metadata/version/review fields,
- roadmap objective, phase map, boundaries, critical path, or launch-gate text,
- semantic roadmap row fields (`lane/phase`, `status`, `owner`, `dependency`, `target_window`, `unblock_ask`),
- excluded-issue rationales,
- issue/PR comments, labels, bodies, or close state,
- governance/policy documents outside the mapping evidence path.

Safe mutation class for this slice:
- artifact writes only.

Candidate repo file for any future human-reviewed repair:
- `docs/product/ROADMAP_V1.md`

## artifact contract
The reconciler writes immutable artifacts and refuses to overwrite an existing target path.

Artifact content includes:
- subject metadata,
- compared source metadata,
- guardrails/no-touch zones,
- issue-by-issue tracking state,
- drift findings,
- action classification,
- candidate touched files,
- blocker/follow-up text,
- reconciliation metrics.

## usage
Live GitHub reconciliation:

```bash
GH_TOKEN="$(gh auth token)" python3 scripts/ops/reconcile_roadmap_open_issues.py \
  --repo BoilerHAUS/moltch \
  --roadmap docs/product/ROADMAP_V1.md \
  --trigger-mode pre-merge \
  --artifact-dir /tmp/moltch-roadmap-reconcile
```

Deterministic fixture reconciliation:

```bash
python3 scripts/ops/reconcile_roadmap_open_issues.py \
  --roadmap scripts/ops/fixtures/roadmap_reconciler/ROADMAP_V1.fixture.md \
  --issues-json scripts/ops/fixtures/roadmap_reconciler/open_issues.fixture.json \
  --trigger-mode post-merge \
  --artifact-dir /tmp/moltch-roadmap-reconcile \
  --generated-at-utc 2026-03-20T00:00:00Z
```

Strict check mode:

```bash
python3 scripts/ops/reconcile_roadmap_open_issues.py \
  --repo BoilerHAUS/moltch \
  --roadmap docs/product/ROADMAP_V1.md \
  --trigger-mode pre-merge \
  --artifact-dir /tmp/moltch-roadmap-reconcile \
  --check
```

## integration
- `scripts/docs/check_docs.sh` uses `pre-merge` mode for the repository docs gate.
- fixture-backed unit validation covers drift classification and immutable artifact emission without requiring live GitHub access.
