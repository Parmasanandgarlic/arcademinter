# Arcademinter

Arcademinter is **reference infrastructure for generating and allocating Solana and EVM vanity addresses without storing private keys in plaintext**. GPU workers generate candidate keypairs, a Node/Express factory API envelope-encrypts private-key material with AWS KMS, and PostgreSQL provides concurrency-safe inventory allocation.

The project is useful as a compact example of key-material handling, distributed GPU workers, envelope encryption and transactional resource allocation. It should be treated as security-sensitive infrastructure, not as a turnkey custody service.

## Architecture

```text
GPU workers
├── Solana miner container
└── EVM miner container
        │ authenticated submit
        ▼
Factory API
├── worker authentication
├── platform/key-delivery authentication
├── input validation
└── AWS KMS envelope encryption
        │
        ▼
PostgreSQL vanity-key inventory
├── available → assigned lifecycle
├── FOR UPDATE SKIP LOCKED allocation
└── single-consumer claim + purge
```

### Trust boundaries

Arcademinter deliberately separates two credentials:

- `WORKER_API_KEY` authenticates GPU workers that may **add** generated keypairs to inventory.
- `PLATFORM_API_KEY` authenticates the platform plane that may **allocate and claim** inventory, including release of decrypted private-key material.

Both privileged boundaries fail closed if their configured secret is missing or shorter than 32 characters. They should be independently generated and distributed to different principals.

## Key lifecycle

1. A miner generates a vanity keypair.
2. The worker submits it over the authenticated worker endpoint.
3. The API asks AWS KMS for an AES-256 data key.
4. The private key is encrypted locally with AES-256-GCM; only the KMS-encrypted data key and ciphertext are stored.
5. A platform caller requests an address by `network` + suffix `pattern`.
6. PostgreSQL locks one available row with `FOR UPDATE SKIP LOCKED`, preventing duplicate allocation under concurrency.
7. The authenticated platform claims the assigned address. The API locks the row, decrypts it, deletes it in the same transaction, commits, and returns the private key once.

The KMS plaintext data-key buffer is zeroed after cryptographic use. Claimed keypairs are removed from the inventory table rather than retained as recoverable plaintext.

## API

All inventory endpoints return `Cache-Control: no-store`.

### Submit generated keypair

`POST /api/v1/submit_keypair`

Header:

```text
x-api-key: <WORKER_API_KEY>
```

Body:

```json
{
  "publicKey": "0x... or Solana base58 public key",
  "privateKey": "runtime key material",
  "network": "evm"
}
```

`network` must be `evm` or `solana`; public-key validation is network aware.

### Allocate address

`GET /api/v1/request_address?network=evm&pattern=abc`

Header:

```text
x-api-key: <PLATFORM_API_KEY>
```

Allocation is transactional and network-scoped. A Solana address cannot accidentally satisfy an EVM request that happens to share the same suffix.

### Claim assigned address

`POST /api/v1/claim_address`

Header:

```text
x-api-key: <PLATFORM_API_KEY>
```

Body:

```json
{
  "publicKey": "0x..."
}
```

The claim path uses a row lock and transaction so concurrent callers cannot both release the same private key.

## Local development

Requirements:

- Docker / Docker Compose
- Node.js 18+
- PostgreSQL (provided by Compose for local use)
- AWS KMS key and credentials through the AWS credential provider chain

```bash
git clone https://github.com/Parmasanandgarlic/arcademinter.git
cd arcademinter/api
cp .env.example .env
npm install
npm test
npm run check
cd ..
docker compose up --build
```

The SQL bootstrap under `db/init/001_init.sql` creates the local inventory table on first database startup.

## Worker configuration

The worker scripts no longer contain embedded endpoint credentials and never log raw miner output, because raw output can contain private-key material.

Provide runtime configuration instead:

```bash
export API_URL='https://factory.example/api/v1/submit_keypair'
export WORKER_API_KEY='a-strong-independent-secret-at-least-32-characters'
export SUFFIX='arc'
./evm-miner/run_miner.sh
```

Use the equivalent command for `solana-miner/run_miner.sh`.

## AWS credential handling

Prefer IAM roles, workload identity, task roles or another AWS default credential-provider-chain mechanism in deployed environments. Static `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` values are not required by the application and should not be baked into images or committed to Git.

KMS permissions should be scoped to the single key and minimum required actions (`kms:GenerateDataKey`, `kms:Decrypt`).

## Production considerations

This repository demonstrates the application-layer controls, but a real deployment still needs infrastructure controls around them:

- TLS between workers/platform callers and the API.
- Private database networking; never publish PostgreSQL directly.
- Secret rotation and a managed secret store.
- Least-privilege AWS IAM and KMS key policies.
- Request logging that excludes request bodies and private-key material.
- Rate limiting / abuse controls appropriate to the deployment.
- Monitoring and alerting around authentication failures, inventory anomalies and KMS failures.
- A deliberate retention/recovery policy for assigned-but-unclaimed inventory.

## Verification

```bash
cd api
npm test
npm run check
```

GitHub Actions additionally runs the API quality gate and the repository credential/dependency audit on pull requests.

## Repository status

Arcademinter is best read as a **security-conscious reference implementation / prototype** for vanity-address inventory infrastructure. The core KMS and concurrency model is implemented; production suitability still depends on the surrounding identity, network, deployment and operational controls described above.
