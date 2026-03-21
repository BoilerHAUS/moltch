# @moltch/policy-engine

Canonical policy-decision state machine + reason-code registry enforcement for issues #163/#164, with migration/lifecycle tooling for #171 and oracle bridge flow support for #155.

## Run

```bash
cd packages/policy-engine
npm run check
```

`npm run check` includes:
- deterministic decision-loop simulation verification against:
  - `packages/policy-engine/fixtures/decision-loop-scenarios.v1.json`
  - `packages/policy-engine/artifacts/decision-loop-simulation.report.json`
  - `packages/policy-engine/artifacts/decision-loop-simulation.report.md`
- deterministic oracle bridge simulation verification against:
  - `packages/policy-engine/fixtures/oracle-bridge-scenarios.v1.json`
  - `packages/policy-engine/artifacts/oracle-bridge-simulation.report.json`
  - `packages/policy-engine/artifacts/oracle-bridge-simulation.report.md`
- reason-code drift validation against:
  - `packages/policy-engine/data/reason-code-registry.v1.json`
  - `docs/governance/POLICY_DECISION_REASON_CODE_CATALOG_V1_2.md`
- migration/replay compatibility validation against:
  - `packages/policy-engine/data/reason-code-migration-map.v1.json`
  - `docs/governance/fixtures/policy_reason_code_replay_compat_v1.json`

To regenerate the simulation artifacts after an intentional decision-path change:

```bash
cd packages/policy-engine
npm run build:simulation
node --input-type=module -e 'import fs from "node:fs"; import { buildOracleBridgeSimulationReport, loadOracleBridgeScenarioSuite, renderOracleBridgeSimulationMarkdown } from "./src/index.mjs"; const suite = loadOracleBridgeScenarioSuite(); const report = buildOracleBridgeSimulationReport(suite); fs.writeFileSync("./artifacts/oracle-bridge-simulation.report.json", JSON.stringify(report, null, 2) + "\n"); fs.writeFileSync("./artifacts/oracle-bridge-simulation.report.md", renderOracleBridgeSimulationMarkdown(report));'
```

## Oracle bridge state machine (#155)

The oracle bridge flow tracks one off-chain execution request through on-chain approval and execution result reporting with auditable linkage:

```text
requested
  -> approval_pending
     -> approved -> executing -> executed -> reconciled
     -> denied   -> reconciled
     -> timed_out -> approval_pending | reconciled
```

Deterministic linkage fields carried through every transition:
- `bridgeRequestId`
- `correlationId`
- `decisionId`
- `approvalId` (once approved)
- `executionId` (once execution result exists)
- deterministic reason codes for denial / timeout / execution result semantics

## Public API

- `createDecisionContext(input)`
- `applyTransition(currentState, nextState, context)`
- `replayDecisionHistory(events, initialState?)`
- reason-code registry helpers:
  - `loadReasonCodeRegistry(pathOrUrl?)`
  - `validateRegistryShape(registry)`
  - `buildReasonCodeIndex(registry)`
  - `assertReasonCodeAllowed(reasonCode, index, options?)`
- reason-code migration helpers:
  - `loadReasonCodeMigrationMap(pathOrUrl?)`
  - `validateMigrationMapShape(map)`
  - `resolveReasonCodeLifecycle(reasonCode, options?)`
  - `buildMigrationReport(records, options?)`
- constants: `DecisionState`, `TERMINAL_STATES`, `TRANSITION_ERROR`, `REASON_CODE_ERROR`, `REASON_CODE_MIGRATION_ERROR`
- identity + attestation helpers:
  - `validateActorIdentitySchema(schema)`
  - `buildActorIdentityIndex(schema)`
  - `canonicalizeForSignature(value)`
  - `signAttestationEnvelope(unsignedEnvelope, options)`
  - `verifyAttestationEnvelope(envelope, options)`

## Actor attestation seam (#209)

The first executable identity slice now treats the attestation envelope as the contract surface and keeps registry/storage choices intentionally secondary.

Versioned role model / action binding expectations:
- actor classes: `human_owner`, `human_operator`, `agent_operator`, `governance_reviewer`, `service_emitter`
- required signed envelope fields include:
  - `subject`
  - `action`
  - `required_role`
  - `constraints_hash`
  - `nonce`
  - `issued_at_utc`
  - `expires_at_utc`
  - `issuer_actor_id`
  - `issuer_kid`
- verifier must enforce: signature validity, action declaration, role binding, expiry, and revocation before accept

Deterministic fixture set lives under:
- `packages/policy-engine/fixtures/identity-attestation/`

Revocation / rotation assumptions for this first slice:
- revocation is a hard gate in verification, not a post-check
- envelopes issued at or after key revocation must reject deterministically
- rotated replacement keys may verify successfully once active, without weakening prior revocation semantics
- this slice does **not** yet define an on-chain registry deployment shape; it defines the executable verification contract that later registry work must honor
- oracle bridge helpers:
  - `createOracleBridgeRequest(input)`
  - `createOracleBridgeContext(input)`
  - `applyOracleBridgeTransition(currentState, nextState, context)`
  - `reconcileOracleBridgeStatus(snapshot, options?)`
  - `createBridgeAdapter(options?)`
  - `buildOracleBridgeTrace(input)`
  - `replayOracleBridgeHistory(events, initialState?)`
  - `loadOracleBridgeScenarioSuite(pathOrUrl?)`
  - `buildOracleBridgeSimulationReport(suite, options?)`
  - `renderOracleBridgeSimulationMarkdown(report)`
- constants: `OracleBridgeState`, `ORACLE_TERMINAL_STATES`, `ORACLE_BRIDGE_ERROR`, `OracleBridgeReasonCode`, `ADAPTER_STATUS_TO_STATE`, `ATTESTATION_ERROR`
