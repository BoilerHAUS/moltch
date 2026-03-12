# commercial analytics dashboard spec v1

## metadata
- version: v1.1.0
- owner_role: agent_product_governance
- review_cadence: biweekly
- next_review_due: 2026-03-25

## objective
Define a read-only v1.1 analytics panel derived from commercial tracker artifacts.

## feature gate
- gate flag: `ENABLE_COMMERCIAL_ANALYTICS`
- default state: disabled until v1 launch checkpoint complete.

## source dataset + provenance
- primary source: `docs/product/FIRST_10_PROSPECTS_CYCLE2.csv`
- UI artifact: `apps/web/artifacts/commercial_analytics_snapshot_v1.json`
- required provenance fields surfaced in UI:
  - source
  - spec
  - refreshed_at

## KPI definitions
- outreach_volume = count(rows)
- positive_reply_rate = positive_reply_true / outreach_volume
- call_booking_rate = calls_booked_true / positive_replies_true
- pilot_offer_rate = pilots_offered_true / calls_booked_true
- pilot_start_rate = pilots_started_true / pilots_offered_true
- disqual_distribution = grouped count by disqual_reason

## UI behavior contract
- loading state: `loading analytics snapshot…`
- empty state: `no analytics snapshot artifact found`
- error state: explicit HTTP/status failure message
- disabled gate state: `feature gated: available after v1 launch checkpoint`

## data quality rules
- boolean fields normalized to `true|false`
- blank status values flagged as `unknown`
- no KPI rendered when denominator is zero (show `n/a`)
