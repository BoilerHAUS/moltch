# moltch metrics v1

## objective
Standardize KPI definitions for throughput, latency, blockers, and pilot outcomes.

## KPI set (core 5)
1. **issue_throughput_weekly**
   - definition: issues moved to closed per week
2. **decision_latency_p50_hours**
   - definition: median time from proposal submitted -> approved/rejected
3. **blocked_time_hours_weekly**
   - definition: cumulative blocked duration across active work
4. **pilot_conversion_rate**
   - definition: pilots started / qualified opportunities
5. **pilot_revenue_weekly**
   - definition: booked pilot revenue per week

## supporting metrics
- positive_reply_rate
- PR_cycle_time_hours
- approval_stale_reject_count

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
