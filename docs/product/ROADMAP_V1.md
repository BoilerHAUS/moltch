# roadmap v1 (now -> launch readiness -> v1.1)

## metadata
- version: v1.0.0
- owner_role: agent_product_governance + agent_technical_delivery
- review_cadence: weekly
- next_review_due: 2026-03-16

## objective
Single execution map so anyone can answer in <2 minutes:
- where we are now
- what ships next
- what is blocked
- what is deferred to v1.1

## status model
- planned
- in_progress
- blocked
- done

## milestone phases
1. foundation
2. integration
3. pilot
4. launch_readiness

## roadmap board
| milestone | item | lane_owner | links | status | dependencies | target window |
|---|---|---|---|---|---|---|
| foundation | docs metadata/link integrity gate | technical/deploy | issue #27, PR #37 | in_progress | none | week of 2026-03-09 |
| foundation | policy registry schema + fixtures | product/governance | issue #29, PR #39 | in_progress | none | week of 2026-03-09 |
| foundation | pilot onboarding kit packet | product/governance | issue #30, PR #40 | in_progress | none | week of 2026-03-09 |
| foundation | decision log template + weekly ledger | product/governance | issue #31, PR #41 | in_progress | none | week of 2026-03-09 |
| foundation | root README refresh | technical/deploy | issue #42, PR #43 | in_progress | none | week of 2026-03-09 |
| integration | github issue/pr sync adapter (read-only) | technical/deploy | issue #34 | planned | foundation docs merged | week of 2026-03-16 |
| integration | cockpit status panel wiring (web <- api) | technical/deploy | issue #35 | planned | #34 data contract | week of 2026-03-16 |
| integration | deploy guardrail CI checks (compose/docs consistency) | technical/deploy | issue #36 | planned | #37 merged | week of 2026-03-16 |
| pilot | run commercial cycle #2 (10 prospects + memo) | product/governance | issue #28, PR #38 | in_progress | #40 merged | weeks of 2026-03-16 to 2026-03-30 |
| launch_readiness | release notes + changelog cadence | product/governance | issue #47 | planned | #41 baseline | week of 2026-03-23 |
| launch_readiness | commercial analytics funnel dashboard spec | product/governance | issue #48 | planned | #28 execution data | week of 2026-03-23 |
| launch_readiness | roadmap v1 upkeep + weekly review | product/governance + technical/deploy | issue #49 | in_progress | none | weekly |

## critical path
1. merge foundation doc PRs (#37, #39, #40, #41, #43)
2. execute integration stream (#34 -> #35 -> #36)
3. run pilot cycle (#28) and capture evidence
4. publish launch-readiness artifacts (#47, #48)

## blockers (current)
- none hard-blocking at time of update
- soft risk: multiple docs PRs open concurrently can create merge churn

## v1 boundary (must-have before launch readiness complete)
- foundation stream merged
- integration stream implemented (#34/#35/#36)
- at least one completed pilot cycle memo from #28
- active weekly decision + roadmap review cadence

## v1.1 defer list
- issue #44: cockpit pane interaction contract and richer state model
- issue #45: decision reason-code catalog + deny taxonomy expansion
- issue #46: pilot offer packaging/scope tiers/success menu

## weekly roadmap review ritual
- cadence: every monday UTC
- owners:
  - product/governance lane: boilermolt
  - technical/deploy lane: boilerclaw
- checklist:
  1. map each open issue to one roadmap row
  2. update status + dependencies
  3. update blocker section
  4. confirm v1 vs v1.1 boundaries remain explicit
