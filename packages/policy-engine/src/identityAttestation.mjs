import { createPrivateKey, createPublicKey, sign, verify } from "node:crypto";

export const ATTESTATION_ERROR = Object.freeze({
  SCHEMA_INVALID: "ERR_ATTESTATION_SCHEMA_INVALID",
  ENVELOPE_FIELDS_UNDECLARED: "ERR_ENVELOPE_FIELDS_UNDECLARED",
  ACTOR_INVALID: "ERR_ACTOR_INVALID",
  KEYSET_INVALID: "ERR_KEYSET_INVALID",
  KEY_NOT_FOUND: "ERR_KEY_NOT_FOUND",
  KEY_NOT_ACTIVE: "ERR_KEY_NOT_ACTIVE",
  KEY_REVOKED: "ERR_KEY_REVOKED",
  ENVELOPE_INVALID: "ERR_ENVELOPE_INVALID",
  ENVELOPE_EXPIRED: "ERR_ENVELOPE_EXPIRED",
  ENVELOPE_NOT_YET_VALID: "ERR_ENVELOPE_NOT_YET_VALID",
  SIGNATURE_INVALID: "ERR_SIGNATURE_INVALID",
  UNSUPPORTED_ALGORITHM: "ERR_UNSUPPORTED_ALGORITHM",
  ROLE_BINDING_INVALID: "ERR_ROLE_BINDING_INVALID",
  ACTION_UNDECLARED: "ERR_ACTION_UNDECLARED"
});

const ACTOR_TYPES = new Set(["human", "agent", "service"]);
const SUPPORTED_ALGORITHMS = new Set(["ed25519"]);
const REQUIRED_UNSIGNED_FIELDS = [
  "subject",
  "action",
  "required_role",
  "constraints_hash",
  "nonce",
  "issued_at_utc",
  "expires_at_utc",
  "issuer_actor_id",
  "issuer_kid"
];

function fail(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

function ensureIso(value, field, code = ATTESTATION_ERROR.SCHEMA_INVALID) {
  const ts = Date.parse(value ?? "");
  if (Number.isNaN(ts)) {
    throw fail(code, `${field} must be an ISO-8601 UTC timestamp`);
  }
  return ts;
}

function stableSortObject(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => stableSortObject(entry));
  }
  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        acc[key] = stableSortObject(value[key]);
        return acc;
      }, {});
  }
  return value;
}

export function canonicalizeForSignature(value) {
  return JSON.stringify(stableSortObject(value));
}

export function validateActorIdentitySchema(schema) {
  if (!schema || typeof schema !== "object") {
    throw fail(ATTESTATION_ERROR.SCHEMA_INVALID, "schema object is required");
  }
  if (!schema.version) {
    throw fail(ATTESTATION_ERROR.SCHEMA_INVALID, "schema.version is required");
  }
  if (!schema.actor_role_claim_schema || typeof schema.actor_role_claim_schema !== "object") {
    throw fail(ATTESTATION_ERROR.SCHEMA_INVALID, "schema.actor_role_claim_schema is required");
  }
  const actorClasses = schema.actor_role_claim_schema.actor_classes;
  const actionRoleBindings = schema.actor_role_claim_schema.action_role_bindings;
  if (!Array.isArray(actorClasses) || actorClasses.length === 0) {
    throw fail(ATTESTATION_ERROR.SCHEMA_INVALID, "actor_role_claim_schema.actor_classes must be non-empty");
  }
  if (!actionRoleBindings || typeof actionRoleBindings !== "object") {
    throw fail(ATTESTATION_ERROR.SCHEMA_INVALID, "actor_role_claim_schema.action_role_bindings is required");
  }
  if (!Array.isArray(schema.actors) || schema.actors.length === 0) {
    throw fail(ATTESTATION_ERROR.SCHEMA_INVALID, "schema.actors must be a non-empty array");
  }

  const actorClassSet = new Set(actorClasses);
  const actorIds = new Set();
  const keyRefs = new Set();

  for (const [action, roles] of Object.entries(actionRoleBindings)) {
    if (!action) {
      throw fail(ATTESTATION_ERROR.SCHEMA_INVALID, "action_role_bindings action key must be non-empty");
    }
    if (!Array.isArray(roles) || roles.length === 0) {
      throw fail(ATTESTATION_ERROR.SCHEMA_INVALID, `action_role_bindings.${action} must be a non-empty array`);
    }
    for (const role of roles) {
      if (!actorClassSet.has(role)) {
        throw fail(ATTESTATION_ERROR.SCHEMA_INVALID, `action ${action} references unknown role ${role}`);
      }
    }
  }

  for (const actor of schema.actors) {
    if (!actor?.actor_id) {
      throw fail(ATTESTATION_ERROR.ACTOR_INVALID, "actor_id is required");
    }
    if (actorIds.has(actor.actor_id)) {
      throw fail(ATTESTATION_ERROR.ACTOR_INVALID, `duplicate actor_id: ${actor.actor_id}`);
    }
    actorIds.add(actor.actor_id);

    if (!ACTOR_TYPES.has(actor.actor_type)) {
      throw fail(ATTESTATION_ERROR.ACTOR_INVALID, `unsupported actor_type: ${actor.actor_type}`);
    }
    if (!Array.isArray(actor.role_claims) || actor.role_claims.length === 0) {
      throw fail(ATTESTATION_ERROR.ACTOR_INVALID, `actor ${actor.actor_id} must define at least one role_claim`);
    }
    for (const role of actor.role_claims) {
      if (!actorClassSet.has(role)) {
        throw fail(ATTESTATION_ERROR.ACTOR_INVALID, `actor ${actor.actor_id} references unknown role_claim ${role}`);
      }
    }
    if (!Array.isArray(actor.keys) || actor.keys.length === 0) {
      throw fail(ATTESTATION_ERROR.KEYSET_INVALID, `actor ${actor.actor_id} must define at least one key`);
    }

    for (const key of actor.keys) {
      if (!key?.kid) {
        throw fail(ATTESTATION_ERROR.KEYSET_INVALID, `actor ${actor.actor_id} key missing kid`);
      }
      const ref = `${actor.actor_id}:${key.kid}`;
      if (keyRefs.has(ref)) {
        throw fail(ATTESTATION_ERROR.KEYSET_INVALID, `duplicate key reference: ${ref}`);
      }
      keyRefs.add(ref);

      if (!SUPPORTED_ALGORITHMS.has(key.alg)) {
        throw fail(ATTESTATION_ERROR.UNSUPPORTED_ALGORITHM, `unsupported key algorithm: ${key.alg}`);
      }
      if (!key.public_key_pem) {
        throw fail(ATTESTATION_ERROR.KEYSET_INVALID, `key ${ref} missing public_key_pem`);
      }
      ensureIso(key.created_at_utc, `key ${ref} created_at_utc`, ATTESTATION_ERROR.KEYSET_INVALID);
      ensureIso(key.valid_from_utc, `key ${ref} valid_from_utc`, ATTESTATION_ERROR.KEYSET_INVALID);
      if (key.expires_at_utc) {
        ensureIso(key.expires_at_utc, `key ${ref} expires_at_utc`, ATTESTATION_ERROR.KEYSET_INVALID);
      }
      if (key.revoked_at_utc) {
        ensureIso(key.revoked_at_utc, `key ${ref} revoked_at_utc`, ATTESTATION_ERROR.KEYSET_INVALID);
      }
    }
  }

  return schema;
}

export function buildActorIdentityIndex(schema) {
  validateActorIdentitySchema(schema);
  const actors = new Map();
  const keys = new Map();

  for (const actor of schema.actors) {
    actors.set(actor.actor_id, actor);
    for (const key of actor.keys) {
      keys.set(`${actor.actor_id}:${key.kid}`, {
        ...key,
        actor_id: actor.actor_id,
        actor_type: actor.actor_type
      });
    }
  }

  return {
    version: schema.version,
    actor_role_claim_schema: schema.actor_role_claim_schema,
    actors,
    keys
  };
}

export function validateUnsignedAttestationEnvelope(envelope) {
  if (!envelope || typeof envelope !== "object") {
    throw fail(ATTESTATION_ERROR.ENVELOPE_INVALID, "envelope object is required");
  }

  const allowedFields = new Set([...REQUIRED_UNSIGNED_FIELDS, "signature_alg", "signature"]);
  const extraFields = Object.keys(envelope).filter((field) => !allowedFields.has(field));
  if (extraFields.length) {
    throw fail(
      ATTESTATION_ERROR.ENVELOPE_FIELDS_UNDECLARED,
      `envelope contains undeclared fields: ${extraFields.sort().join(", ")}`
    );
  }

  for (const field of REQUIRED_UNSIGNED_FIELDS) {
    if (!envelope[field]) {
      throw fail(ATTESTATION_ERROR.ENVELOPE_INVALID, `envelope missing ${field}`);
    }
  }

  ensureIso(envelope.issued_at_utc, "issued_at_utc", ATTESTATION_ERROR.ENVELOPE_INVALID);
  const issuedAt = ensureIso(envelope.issued_at_utc, "issued_at_utc", ATTESTATION_ERROR.ENVELOPE_INVALID);
  const expiresAt = ensureIso(envelope.expires_at_utc, "expires_at_utc", ATTESTATION_ERROR.ENVELOPE_INVALID);
  if (expiresAt <= issuedAt) {
    throw fail(ATTESTATION_ERROR.ENVELOPE_INVALID, "expires_at_utc must be later than issued_at_utc");
  }

  return {
    subject: envelope.subject,
    action: envelope.action,
    required_role: envelope.required_role,
    constraints_hash: envelope.constraints_hash,
    nonce: envelope.nonce,
    issued_at_utc: envelope.issued_at_utc,
    expires_at_utc: envelope.expires_at_utc,
    issuer_actor_id: envelope.issuer_actor_id,
    issuer_kid: envelope.issuer_kid
  };
}

export function signAttestationEnvelope(unsignedEnvelope, { privateKeyPem, alg = "ed25519" }) {
  if (!SUPPORTED_ALGORITHMS.has(alg)) {
    throw fail(ATTESTATION_ERROR.UNSUPPORTED_ALGORITHM, `unsupported signing algorithm: ${alg}`);
  }
  const normalized = validateUnsignedAttestationEnvelope(unsignedEnvelope);
  const payload = canonicalizeForSignature(normalized);
  const privateKey = createPrivateKey(privateKeyPem);
  const signature = sign(null, Buffer.from(payload), privateKey).toString("base64");

  return {
    ...normalized,
    signature_alg: alg,
    signature
  };
}

function assertKeyActiveForEnvelope(keyRecord, envelope, { now = new Date(), clockSkewSec = 60 } = {}) {
  const issuedAt = ensureIso(envelope.issued_at_utc, "issued_at_utc", ATTESTATION_ERROR.ENVELOPE_INVALID);
  const expiresAt = ensureIso(envelope.expires_at_utc, "expires_at_utc", ATTESTATION_ERROR.ENVELOPE_INVALID);
  const nowTs = now instanceof Date ? now.getTime() : Date.parse(now);
  const skewMs = clockSkewSec * 1000;
  const validFrom = ensureIso(keyRecord.valid_from_utc, "valid_from_utc", ATTESTATION_ERROR.KEYSET_INVALID);

  if (issuedAt + skewMs < validFrom) {
    throw fail(ATTESTATION_ERROR.KEY_NOT_ACTIVE, `key ${keyRecord.kid} not active at envelope issued_at_utc`);
  }

  if (keyRecord.revoked_at_utc) {
    const revokedAt = ensureIso(keyRecord.revoked_at_utc, "revoked_at_utc", ATTESTATION_ERROR.KEYSET_INVALID);
    if (issuedAt >= revokedAt - skewMs) {
      throw fail(ATTESTATION_ERROR.KEY_REVOKED, `key ${keyRecord.kid} revoked for envelope issuance window`);
    }
  }

  if (keyRecord.expires_at_utc) {
    const keyExpiry = ensureIso(keyRecord.expires_at_utc, "expires_at_utc", ATTESTATION_ERROR.KEYSET_INVALID);
    if (issuedAt >= keyExpiry - skewMs) {
      throw fail(ATTESTATION_ERROR.KEY_NOT_ACTIVE, `key ${keyRecord.kid} expired for envelope issuance window`);
    }
  }

  if (nowTs > expiresAt + skewMs) {
    throw fail(ATTESTATION_ERROR.ENVELOPE_EXPIRED, "attestation envelope expired");
  }
  if (nowTs + skewMs < issuedAt) {
    throw fail(ATTESTATION_ERROR.ENVELOPE_NOT_YET_VALID, "attestation envelope issued_at_utc is in the future");
  }
}

export function verifyAttestationEnvelope(envelope, { actorIndex, now = new Date(), clockSkewSec = 60 } = {}) {
  if (!actorIndex?.keys) {
    throw fail(ATTESTATION_ERROR.SCHEMA_INVALID, "actorIndex is required for verification");
  }
  if (!envelope?.signature || !envelope?.signature_alg) {
    throw fail(ATTESTATION_ERROR.ENVELOPE_INVALID, "signed envelope requires signature and signature_alg");
  }
  if (!SUPPORTED_ALGORITHMS.has(envelope.signature_alg)) {
    throw fail(ATTESTATION_ERROR.UNSUPPORTED_ALGORITHM, `unsupported signature algorithm: ${envelope.signature_alg}`);
  }

  const unsignedPayload = validateUnsignedAttestationEnvelope(envelope);
  const keyRef = `${unsignedPayload.issuer_actor_id}:${unsignedPayload.issuer_kid}`;
  const keyRecord = actorIndex.keys.get(keyRef);
  if (!keyRecord) {
    throw fail(ATTESTATION_ERROR.KEY_NOT_FOUND, `key not found: ${keyRef}`);
  }

  assertKeyActiveForEnvelope(keyRecord, unsignedPayload, { now, clockSkewSec });

  const publicKey = createPublicKey(keyRecord.public_key_pem);
  const payload = canonicalizeForSignature(unsignedPayload);
  const ok = verify(null, Buffer.from(payload), publicKey, Buffer.from(envelope.signature, "base64"));
  if (!ok) {
    throw fail(ATTESTATION_ERROR.SIGNATURE_INVALID, "attestation signature verification failed");
  }

  const actorRecord = actorIndex.actors.get(keyRecord.actor_id);
  const requiredRole = unsignedPayload.required_role;
  const allowedRoles = actorIndex.actor_role_claim_schema?.action_role_bindings?.[unsignedPayload.action];
  if (!allowedRoles) {
    throw fail(ATTESTATION_ERROR.ACTION_UNDECLARED, `action ${unsignedPayload.action} is not declared in action_role_bindings`);
  }
  if (!actorRecord?.role_claims?.includes(requiredRole) || !allowedRoles.includes(requiredRole)) {
    throw fail(ATTESTATION_ERROR.ROLE_BINDING_INVALID, `actor ${keyRecord.actor_id} is not authorized for role ${requiredRole} on action ${unsignedPayload.action}`);
  }

  return {
    ok: true,
    actor_id: keyRecord.actor_id,
    actor_type: keyRecord.actor_type,
    role_claims: actorRecord.role_claims,
    kid: keyRecord.kid,
    alg: envelope.signature_alg,
    envelope: unsignedPayload
  };
}
