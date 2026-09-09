# Arcademinter Threat Model

## Scope

Arcademinter is reference infrastructure for generating, encrypting, allocating, and releasing vanity-address keypairs. This document covers the application-layer worker → API → PostgreSQL flow and its AWS KMS dependency. It does not claim to secure an otherwise compromised host, cloud account, database administrator, CI system, or downstream wallet handoff.

## Assets

The primary sensitive assets are:

- plaintext private keys during the short generation/encryption and claim/decryption windows;
- KMS-encrypted data keys and AES-GCM private-key ciphertext stored in PostgreSQL;
- `WORKER_API_KEY` and `PLATFORM_API_KEY` credentials;
- one-time claim tokens between allocation and claim;
- AWS credentials/role authority capable of `kms:GenerateDataKey` and `kms:Decrypt`;
- database integrity and allocation state.

Public addresses, network identifiers, suffix patterns, and non-sensitive inventory metadata are not secrets, but unauthorized modification can still affect correctness.

## Trust boundaries

### GPU worker → Factory API

Workers are allowed to submit generated keypairs but are not allowed to allocate or claim inventory. The boundary is authenticated independently with `WORKER_API_KEY`. Worker output must never be logged because miner output may contain private-key material.

### Platform caller → Factory API

The platform boundary may allocate and claim inventory and therefore can trigger release of a private key. It uses a separate `PLATFORM_API_KEY`. A platform credential alone is insufficient to claim an assigned row: the caller must also present the live one-time claim token created during allocation.

### Factory API → AWS KMS

The API requests AES-256 data keys and decrypts wrapped data keys through AWS KMS. Production IAM should grant only the required KMS actions against the intended key. The plaintext data-key bytes exist in process memory only for local AES-GCM operations and are overwritten after use.

### Factory API → PostgreSQL

PostgreSQL stores only encrypted private-key payloads. Allocation uses row locking and `FOR UPDATE SKIP LOCKED`; claiming uses a row lock plus transaction so one assigned key cannot be released successfully to two concurrent callers. Claim-token plaintext is never stored.

## Security invariants

1. No private key is intentionally persisted in plaintext.
2. Worker and platform credentials are separate and fail closed when missing or weak.
3. Address allocation is scoped by both network and suffix pattern.
4. Allocation creates a random, bounded-lifetime claim token; only its SHA-256 hash is stored.
5. Private-key release requires platform authentication, the matching public address, and a live matching claim token.
6. Successful claim deletes the encrypted inventory row in the same transaction that protects release.
7. API responses containing inventory or secret-bearing material are marked `Cache-Control: no-store`.
8. Raw worker/miner output is not logged.

## Threats and controls

| Threat | Application control | Remaining production responsibility |
| --- | --- | --- |
| Worker credential theft | Separate worker-only credential; worker cannot claim inventory | Rotate secrets, rate limit, restrict worker network identity |
| Platform credential theft | One-time claim token also required for release | Protect platform secret and claim-token transport; monitor allocation anomalies |
| Concurrent double allocation | PostgreSQL row locking + `SKIP LOCKED` | Operate a correctly configured transactional PostgreSQL service |
| Concurrent double claim | Row lock + claim/delete transaction | Preserve database isolation and avoid out-of-band key copies |
| Database exfiltration | Private keys are envelope-encrypted | Protect KMS authority; restrict DB/network access; secure backups |
| KMS data-key disclosure in process memory | Plaintext data-key buffers overwritten after cryptographic use | Harden host/runtime; avoid swap/core dumps where appropriate |
| Secret leakage through logs | API does not log request bodies or key material; workers suppress raw miner output | Configure proxies/APM/logging to exclude bodies and sensitive headers |
| Replay of an allocation response | Claim token is one-time and lease-bounded | Use TLS and secure downstream handoff/storage |
| Malformed or oversized input | Bounded JSON body and network-aware validation | Add deployment-specific WAF/rate limits where appropriate |

## Explicitly out of scope

- protecting funds after a private key has been handed to a downstream consumer;
- defending against a fully compromised API host with access to runtime memory and KMS authority;
- HSM-grade custody guarantees;
- wallet policy, transaction signing, or transaction authorization after claim;
- availability against volumetric denial of service without external controls;
- security of third-party vanity-miner binaries or container base images beyond normal dependency/supply-chain review.

## Deployment requirements

A production operator should add TLS, private database networking, managed secret storage and rotation, least-privilege IAM/KMS policies, dependency and image scanning, rate limiting, authentication monitoring, encrypted backups, incident response, and a documented downstream key-handoff procedure. No example configuration in this repository should be treated as a production security boundary by itself.
