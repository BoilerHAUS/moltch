import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { generateKeyPairSync } from "node:crypto";
import {
  ATTESTATION_ERROR,
  buildActorIdentityIndex,
  canonicalizeForSignature,
  signAttestationEnvelope,
  validateActorIdentitySchema,
  verifyAttestationEnvelope
} from "../src/index.mjs";

function buildSchema() {
  const oldPair = generateKeyPairSync("ed25519");
  const newPair = generateKeyPairSync("ed25519");
  const humanPair = generateKeyPairSync("ed25519");

  return {
    schema: {
      version: "v1.0.0",
      actor_role_claim_schema: {
        version: "v1.0.0",
        actor_classes: ["human_owner", "human_operator", "agent_operator", "governance_reviewer", "service_emitter"],
        action_role_bindings: {
          "contracts.sign": ["human_owner", "human_operator", "agent_operator"],
          "contracts.approve": ["human_owner", "governance_reviewer"],
          "contracts.emit": ["service_emitter", "agent_operator"]
        }
      },
      actors: [
        {
          actor_id: "agent:boilerclaw",
          actor_type: "agent",
          role_claims: ["agent_operator"],
          keys: [
            {
              kid: "agent-key-old",
              alg: "ed25519",
              public_key_pem: oldPair.publicKey.export({ type: "spki", format: "pem" }),
              created_at_utc: "2026-03-15T00:00:00Z",
              valid_from_utc: "2026-03-15T00:00:00Z",
              revoked_at_utc: "2026-03-18T00:00:00Z"
            },
            {
              kid: "agent-key-new",
              alg: "ed25519",
              public_key_pem: newPair.publicKey.export({ type: "spki", format: "pem" }),
              created_at_utc: "2026-03-18T00:00:00Z",
              valid_from_utc: "2026-03-18T00:00:00Z",
              expires_at_utc: "2026-06-01T00:00:00Z"
            }
          ]
        },
        {
          actor_id: "human:boiler",
          actor_type: "human",
          role_claims: ["human_owner", "human_operator"],
          keys: [
            {
              kid: "human-key-1",
              alg: "ed25519",
              public_key_pem: humanPair.publicKey.export({ type: "spki", format: "pem" }),
              created_at_utc: "2026-03-01T00:00:00Z",
              valid_from_utc: "2026-03-01T00:00:00Z",
              expires_at_utc: "2026-06-01T00:00:00Z"
            }
          ]
        }
      ]
    },
    oldPrivateKeyPem: oldPair.privateKey.export({ type: "pkcs8", format: "pem" }),
    newPrivateKeyPem: newPair.privateKey.export({ type: "pkcs8", format: "pem" }),
    humanPrivateKeyPem: humanPair.privateKey.export({ type: "pkcs8", format: "pem" })
  };
}

function unsignedEnvelope(overrides = {}) {
  return {
    subject: "decision:launch-gate:154",
    action: "contracts.sign",
    required_role: "agent_operator",
    constraints_hash: "sha256:abc123",
    nonce: "nonce-154-a",
    issued_at_utc: "2026-03-18T00:10:00Z",
    expires_at_utc: "2026-03-18T00:15:00Z",
    issuer_actor_id: "agent:boilerclaw",
    issuer_kid: "agent-key-new",
    ...overrides
  };
}

test("actor identity schema validates and canonicalization is deterministic", () => {
  const { schema } = buildSchema();
  assert.equal(validateActorIdentitySchema(schema), schema);
  assert.equal(
    canonicalizeForSignature({ b: 2, a: { d: 4, c: 3 } }),
    '{"a":{"c":3,"d":4},"b":2}'
  );
});

test("valid signature + role binding verifies successfully", () => {
  const { schema, newPrivateKeyPem } = buildSchema();
  const actorIndex = buildActorIdentityIndex(schema);
  const envelope = signAttestationEnvelope(unsignedEnvelope(), { privateKeyPem: newPrivateKeyPem });
  const result = verifyAttestationEnvelope(envelope, {
    actorIndex,
    now: new Date("2026-03-18T00:11:00Z")
  });

  assert.equal(result.ok, true);
  assert.equal(result.actor_id, "agent:boilerclaw");
  assert.equal(result.kid, "agent-key-new");
  assert.ok(result.role_claims.includes("agent_operator"));
});

test("fixture files exist for valid and invalid attestation envelopes", () => {
  const fixtureDir = path.join(process.cwd(), "fixtures", "identity-attestation");
  for (const name of [
    "actor-attestation-schema.v1.json",
    "attestation-envelope-valid.json",
    "attestation-envelope-wrong-role.json",
    "attestation-envelope-expired.json",
    "attestation-envelope-revoked.json"
  ]) {
    assert.ok(fs.existsSync(path.join(fixtureDir, name)), `${name} fixture missing`);
  }
});

test("envelope with undeclared fields fails closed deterministically", () => {
  const { schema, newPrivateKeyPem } = buildSchema();
  const actorIndex = buildActorIdentityIndex(schema);
  const envelope = signAttestationEnvelope(unsignedEnvelope(), { privateKeyPem: newPrivateKeyPem });
  envelope.policy_version = "v9-shadow";

  assert.throws(
    () => verifyAttestationEnvelope(envelope, { actorIndex, now: new Date("2026-03-18T00:11:00Z") }),
    (err) => err.code === ATTESTATION_ERROR.ENVELOPE_FIELDS_UNDECLARED
  );
});

test("tampered payload fails with deterministic signature error", () => {
  const { schema, newPrivateKeyPem } = buildSchema();
  const actorIndex = buildActorIdentityIndex(schema);
  const envelope = signAttestationEnvelope(unsignedEnvelope(), { privateKeyPem: newPrivateKeyPem });
  envelope.constraints_hash = "sha256:tampered";

  assert.throws(
    () => verifyAttestationEnvelope(envelope, { actorIndex, now: new Date("2026-03-18T00:11:00Z") }),
    (err) => err.code === ATTESTATION_ERROR.SIGNATURE_INVALID
  );
});

test("valid signature + revoked key rejects deterministically", () => {
  const { schema, oldPrivateKeyPem } = buildSchema();
  const actorIndex = buildActorIdentityIndex(schema);
  const envelope = signAttestationEnvelope(
    unsignedEnvelope({ issuer_kid: "agent-key-old" }),
    { privateKeyPem: oldPrivateKeyPem }
  );

  assert.throws(
    () => verifyAttestationEnvelope(envelope, { actorIndex, now: new Date("2026-03-18T00:11:00Z"), clockSkewSec: 0 }),
    (err) => err.code === ATTESTATION_ERROR.KEY_REVOKED
  );
});

test("valid signature + wrong role for action rejects deterministically", () => {
  const { schema, newPrivateKeyPem } = buildSchema();
  const actorIndex = buildActorIdentityIndex(schema);
  const envelope = signAttestationEnvelope(
    unsignedEnvelope({ action: "contracts.approve", required_role: "governance_reviewer" }),
    { privateKeyPem: newPrivateKeyPem }
  );

  assert.throws(
    () => verifyAttestationEnvelope(envelope, { actorIndex, now: new Date("2026-03-18T00:11:00Z") }),
    (err) => err.code === ATTESTATION_ERROR.ROLE_BINDING_INVALID
  );
});

test("expired attestation rejects deterministically", () => {
  const { schema, newPrivateKeyPem } = buildSchema();
  const actorIndex = buildActorIdentityIndex(schema);
  const envelope = signAttestationEnvelope(unsignedEnvelope(), { privateKeyPem: newPrivateKeyPem });

  assert.throws(
    () => verifyAttestationEnvelope(envelope, { actorIndex, now: new Date("2026-03-18T00:17:00Z"), clockSkewSec: 0 }),
    (err) => err.code === ATTESTATION_ERROR.ENVELOPE_EXPIRED
  );
});
