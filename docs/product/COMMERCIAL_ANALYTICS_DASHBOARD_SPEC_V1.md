# commercial analytics dashboard spec v1

## metadata
- version: v1.0.0
- owner_role: agent_product_governance
- review_cadence: biweekly
- next_review_due: 2026-03-23

## objective
Define a v1 funnel dashboard spec derived from tracker fields to evaluate commercial loop quality.

## source dataset
- primary source: `docs/product/FIRST_10_PROSPECTS_CYCLE2.csv`
- required fields: response_status, positive_reply, call_booked, pilot_offered, pilot_started, disqual_reason, source, owner

## KPI definitions
- outreach_volume = count(rows)
- positive_reply_rate = positive_reply_true / outreach_volume
- call_booking_rate = calls_booked_true / positive_replies_true
- pilot_offer_rate = pilots_offered_true / calls_booked_true
- pilot_start_rate = pilots_started_true / pilots_offered_true
- disqual_distribution = grouped count by disqual_reason

## views
- top-line KPI tiles
- weekly trend line (where date fields exist)
- segment/source breakdown
- owner performance split

## data quality rules
- boolean fields normalized to `true|false`
- blank status values flagged as `unknown`
- no KPI rendered when denominator is zero (show `n/a`)
