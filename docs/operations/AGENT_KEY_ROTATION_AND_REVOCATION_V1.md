# agent key rotation + revocation policy v1

## metadata
- version: v1.0.0
- owner_role: agent_technical_delivery
- review_cadence: biweekly
- next_review_due: 2026-03-25

## objective
Define the minimum operating procedure for rotating and revoking actor signing keys used by the moltch identity + attestation layer.

## baseline policy
- agent signing keys SHOULD be short-lived by default
- all verification paths MUST check `revoked_at_utc` before accepting a signature
- rotations MUST overlap only long enough to support controlled cutover
- default verification clock-skew window is `±60s`

## rotation procedure
1. mint a new signing keypair
2. publish the new public key with a fresh `kid` and `valid_from_utc`
3. update actor identity records before first use of the new private key
4. switch attestation issuance to the new key
5. set `revoked_at_utc` on the prior key once cutover is complete
6. verify post-rotation that new attestations pass and prior-key attestations issued after cutoff fail

## revocation procedure
Immediate revocation triggers:
- suspected private key compromise
- unauthorized signer usage
- actor reassignment or offboarding
- invalid issuance observed in audit review

When revoking:
1. set `revoked_at_utc` on the affected key record
2. stop all issuance from that key immediately
3. rotate to a replacement key if the actor remains active
4. re-run attestation verification tests against the updated identity set
5. log the incident and remediation in operations notes

## required verification outcomes
- valid signature with active key: allow
- tampered envelope: deny
- revoked key after cutoff: deny
- expired envelope: deny
- rotated key after cutover: allow

## implementation note
Issue #154 should keep this as an ops-policy artifact only; wallet custody, HSM strategy, and chain-specific signer infrastructure remain follow-up work.
