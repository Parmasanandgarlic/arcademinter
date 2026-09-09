# Arcademinter Public Hardening Design

## Goal

Prepare Arcademinter for public open-source release as a security-conscious reference implementation that competent engineers can clone, inspect, test, and extend without overstating production readiness.

## Architecture direction

Keep the existing worker → API → PostgreSQL model, but improve the API boundary and operational quality rather than expanding product scope. Preserve the existing KMS envelope-encryption model, separate worker/platform credentials, one-time claim tokens, and transactional `FOR UPDATE SKIP LOCKED` allocation.

The hardening pass will:

- migrate AWS KMS usage from the end-of-support AWS SDK v2 package to the modular AWS SDK v3 client;
- keep secret-bearing data out of logs and HTTP caches;
- preserve fail-closed worker/platform authentication and claim-token handling;
- strengthen validation and test coverage around security-sensitive helpers;
- add public-release documentation (`LICENSE`, `SECURITY.md`, architecture/threat-model notes);
- make local verification and CI clearer and reproducible;
- avoid broad feature work or introducing custody-oriented claims.

## Public-release standard

The repository must clearly identify itself as reference/prototype infrastructure, not a turnkey custody service. Examples must use synthetic placeholders only. Documentation must explain trust boundaries, deployment assumptions, and the fact that surrounding IAM/network/operations controls are required for production.

## Verification

A release candidate is acceptable only when static syntax checks, unit tests, dependency audit commands, workflow definitions, and repository secret-hygiene guidance all align with the documented setup. No live KMS credentials or real private keys are required for unit tests.
