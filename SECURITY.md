# Security Policy

Arcademinter handles private-key material and should be treated as security-sensitive reference infrastructure.

## Supported code

Security fixes are made against the current `main` branch. Historical commits and unmaintained forks are not supported releases.

## Reporting a vulnerability

Do not include private keys, API keys, claim tokens, AWS credentials, database credentials, or other live secrets in a public issue, pull request, discussion, log, or screenshot.

If GitHub private vulnerability reporting is available for this repository, use it. Otherwise, open a minimal public issue asking the maintainers for a private reporting channel and include no exploit details or sensitive values.

A useful report includes:

- the affected commit or release;
- the vulnerable component and trust boundary;
- reproducible steps using synthetic data only;
- expected and observed behavior;
- realistic impact and required attacker capabilities;
- a proposed remediation when known.

## Credential exposure

Any credential or private key committed to Git history, copied into an issue, or otherwise published must be treated as compromised even if it is later deleted from the current tree. Rotate or revoke the credential and move authority/assets away from exposed private keys before relying on repository cleanup.

## Security model

The application-layer controls and production assumptions are documented in [`docs/THREAT_MODEL.md`](docs/THREAT_MODEL.md). Arcademinter is a reference implementation, not a turnkey custody service; production deployment requires independent IAM, network, monitoring, secret-management, and operational controls.
