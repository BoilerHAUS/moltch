# agent identity + attestation schema v1

## metadata
- version: v1.0.0
- owner_role: agent_product_governance
- review_cadence: biweekly
- next_review_due: 2026-03-25

## objective
Define the minimal identity model and signed attestation envelope for human, agent, and service actors participating in on-chain-adjacent policy execution.

## actor identity schema
Required top-level fields:
- `version`
- `actors[]`

Each actor record MUST include:
- `actor_id`
- `actor_type` (`human|agent|service`)
- `keys[]`

Each key record MUST include:
- `kid`
- `alg` (`ed25519` in v1)
- `public_key_pem`
- `created_at_utc`
- `valid_from_utc`

Optional key lifecycle fields:
- `expires_at_utc`
- `revoked_at_utc`

## signed attestation envelope
Required fields:
- `subject`
- `action`
- `constraints_hash`
- `nonce`
- `issued_at_utc`
- `expires_at_utc`
- `issuer_actor_id`
- `issuer_kid`
- `signature_alg`
- `signature`

## verification contract
Verification MUST fail closed when any of the following are true:
- actor identity is unknown
- referenced key is unknown
- key is not yet active for `issued_at_utc`
- key is revoked for the issuance window
- envelope is expired
- signature verification fails

Default clock-skew tolerance:
- `±60s`

## deterministic verification error codes
- `ERR_ATTESTATION_SCHEMA_INVALID`
- `ERR_ACTOR_INVALID`
- `ERR_KEYSET_INVALID`
- `ERR_KEY_NOT_FOUND`
- `ERR_KEY_NOT_ACTIVE`
- `ERR_KEY_REVOKED`
- `ERR_ENVELOPE_INVALID`
- `ERR_ENVELOPE_EXPIRED`
- `ERR_ENVELOPE_NOT_YET_VALID`
- `ERR_SIGNATURE_INVALID`
- `ERR_UNSUPPORTED_ALGORITHM`

## canonicalization rules
The signature payload MUST be computed over the unsigned envelope with:
- recursively sorted object keys
- UTF-8 JSON serialization
- no transient verification fields beyond the declared envelope contract

## starter schema example
```json
{
  "version": "v1.0.0",
  "actors": [
    {
      "actor_id": "agent:boilerclaw",
      "actor_type": "agent",
      "keys": [
        {
          "kid": "agent-key-2026-03-18",
          "alg": "ed25519",
          "public_key_pem": "-----BEGIN PUBLIC KEY-----...",
          "created_at_utc": "2026-03-18T00:00:00Z",
          "valid_from_utc": "2026-03-18T00:00:00Z",
          "expires_at_utc": "2026-06-01T00:00:00Z"
        }
      ]
    }
  ]
}
```

## threat model notes
Core compromise scenarios to account for:
- agent private key theft
- replay attempts using stale envelopes
- use of revoked keys after rotation cutoff
- actor impersonation via mismatched `actor_id` / `kid`
- signature bypass through payload tampering
