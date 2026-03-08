# moltch metrics v1

## metadata
- version: v1.0.1
- owner_role: agent_product_governance
- review_cadence: weekly
- next_review_due: 2026-03-15

## objective
Standardize KPI definitions for throughput, latency, blockers, and pilot outcomes.

## KPI set (core 5)
1. **issue_throughput_weekly**
   - definition: issues moved to closed per week
   - source_of_truth: GitHub Issues API
2. **decision_latency_p50_hours**
   - definition: median time from proposal submitted -> approved/rejected
   - source_of_truth: governance decision logs (manual until telemetry)
3. **blocked_time_hours_weekly**
   - definition: cumulative blocked duration across active work
   - source_of_truth: weekly report blocked entries
4. **pilot_conversion_rate**
   - definition: pilots started / qualified opportunities
   - denominator edge case: if qualified opportunities = 0, report `N/A` (not 0%)
   - source_of_truth: commercial tracker sheet/manual log
5. **pilot_revenue_weekly**
   - definition: booked pilot revenue per week
   - source_of_truth: manual finance ledger (v1)

## supporting metrics
- positive_reply_rate (source: outreach tracker)
- PR_cycle_time_hours (source: GitHub PR API)
- approval_stale_reject_count (source: governance decision logs)

## reporting windows
- operational metrics: weekly
- commercial metrics: weekly + monthly rollup

## baseline targets (initial)
- decision_latency_p50_hours <= 12
- blocked_time_hours_weekly <= 8
- PR_cycle_time_hours <= 24

## data quality rules
- definitions MUST stay stable for one full month before changes.
- if definition changes, version metric and annotate break in trendline.