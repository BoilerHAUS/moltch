import test from "node:test";
import assert from "node:assert/strict";
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

  return {
    schema: {
      version: "v1.0.0",
      actors: [
        {
          actor_id: "agent:boilerclaw",
          actor_type: "agent",
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
        }
      ]
    },
    oldPrivateKeyPem: oldPair.privateKey.export({ type: "pkcs8", format: "pem" }),
    newPrivateKeyPem: newPair.privateKey.export({ type: "pkcs8", format: "pem" })
  };
}

function unsignedEnvelope(overrides = {}) {
  return {
    subject: "decision:launch-gate:154",
    action: "policy.attest",
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

test("valid signature verifies successfully", () => {
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

test("revoked key fails verification after cutoff", () => {
  const { schema, oldPrivateKeyPem } = buildSchema();
  const actorIndex = buildActorIdentityIndex(schema);
  const envelope = signAttestationEnvelope(
    unsignedEnvelope({
      issuer_kid: "agent-key-old",
      issued_at_utc: "2026-03-18T00:10:00Z",
      expires_at_utc: "2026-03-18T00:15:00Z"
    }),
    { privateKeyPem: oldPrivateKeyPem }
  );

  assert.throws(
    () => verifyAttestationEnvelope(envelope, { actorIndex, now: new Date("2026-03-18T00:11:00Z"), clockSkewSec: 0 }),
    (err) => err.code === ATTESTATION_ERROR.KEY_REVOKED
  );
});

test("expired envelope fails verification", () => {
  const { schema, newPrivateKeyPem } = buildSchema();
  const actorIndex = buildActorIdentityIndex(schema);
  const envelope = signAttestationEnvelope(unsignedEnvelope(), { privateKeyPem: newPrivateKeyPem });

  assert.throws(
    () => verifyAttestationEnvelope(envelope, { actorIndex, now: new Date("2026-03-18T00:17:00Z"), clockSkewSec: 0 }),
    (err) => err.code === ATTESTATION_ERROR.ENVELOPE_EXPIRED
  );
});

test("rotated key passes after prior key cutoff", () => {
  const { schema, newPrivateKeyPem } = buildSchema();
  const actorIndex = buildActorIdentityIndex(schema);
  const envelope = signAttestationEnvelope(unsignedEnvelope(), { privateKeyPem: newPrivateKeyPem });

  const result = verifyAttestationEnvelope(envelope, {
    actorIndex,
    now: new Date("2026-03-18T00:11:00Z"),
    clockSkewSec: 0
  });

  assert.equal(result.ok, true);
  assert.equal(result.kid, "agent-key-new");
});
