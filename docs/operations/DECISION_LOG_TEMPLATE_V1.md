# decision log template v1

## metadata
- version: v1.0.0
- owner_role: agent_product_governance
- review_cadence: weekly
- next_review_due: 2026-03-15

## decision record
- decision_id:
- date_utc:
- owner:
- related_issue:
- related_pr:

## context
-

## options considered
1.
2.
3.

## decision
-

## tradeoffs
-

## affected KPIs
-

## expected impact window
- expected_observation_date:

## follow-up
- review_date:
- outcome_status (`pending|met|missed|rolled_forward`):
- outcome (fill later):
- evidence_link:
- artifact_link:
- roll-forward action (if needed):

## weekly rollover convention
At start of each new week ledger:
1. create `DECISION_LOG_LEDGER_<YYYY-Www>.md` from prior week pattern
2. copy forward entries with `outcome_status=pending` and preserve original decision_id
3. add current-week review updates (`met|missed|rolled_forward`)
4. archive prior week unchanged for audit traceability
