# commercial v1 loop

## metadata
- version: v1.0.1
- owner_role: agent_product_governance
- review_cadence: weekly
- next_review_due: 2026-03-15

## objective
Define initial ICP, positioning, outreach narrative, and conversion loop for first pilots.

## initial ICP (single segment)
- small technical operator teams (2-10 people)
- active GitHub-based execution workflow
- pain: fragmented multi-agent coordination + unclear approvals/auditability

### disqualification criteria (not a fit)
- team size <2 or >10 for v1 pilot
- no active GitHub workflow
- no current or planned agent-assisted execution
- cannot run a 14-day pilot with a named owner

## value proposition
moltch gives teams one coordination cockpit to run agent work with visible governance, faster decisions, and auditable execution.

## positioning statement
For small operator teams coordinating AI-agent work, moltch is a governance-first coordination cockpit that links threads, issues/PRs, and approval states in one place.

## outreach narrative (v1)
- hook: "you already have agents running; your bottleneck is coordination and approval latency"
- promise: "reduce decision lag and status ambiguity with governed execution visibility"
- CTA: "15-minute workflow mapping call"

## first conversion funnel
1. prospect identified
2. first outreach sent
3. positive reply
4. discovery call booked
5. pilot offered
6. pilot started
7. pilot retained (30-day)

## stage event definitions
- **prospect identified:** ICP fit confirmed and owner assigned in tracker.
- **first outreach sent:** initial personalized message delivered on chosen channel.
- **positive reply:** explicit interest to continue (question, call interest, or clear "tell me more").
- **discovery call booked:** calendar-confirmed meeting time.
- **pilot offered:** scoped pilot proposal sent with timeline.
- **pilot started:** kickoff held and day-0 tasks accepted.
- **pilot retained (30-day):** pilot continues or converts after day 30.

## message variants (A/B)
- **A (latency-led):** reduce decision latency + blocked time
- **B (audit-led):** improve governance confidence + action traceability

## success criteria for first cycle
- 10 qualified prospects contacted
- >= 3 positive replies
- >= 2 calls booked
- >= 1 pilot started

## loss reason taxonomy
- no clear pain
- wrong timing
- no budget
- security/compliance concern
- no owner/champion
- not ICP fit

## handoff rules (product <-> outreach)
- if positive_reply_rate < 20% after 10 outreaches: revise positioning and ICP before scaling
- if calls booked but pilots low: refine pilot offer scope + onboarding friction
- if pilots start but retain low: feed product blockers into v1.1 backlog with priority
- if same objection appears >=3 times in one cycle: open or annotate a product issue with evidence snippets
