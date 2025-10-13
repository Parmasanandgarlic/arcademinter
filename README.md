# Vanity Address Mint Factory - Backend Services

This repository contains the backend infrastructure for the Solana and EVM vanity address minting factory. It includes the GPU miner configurations and the central API for securely storing and retrieving keypairs.

---

## Architecture Overview

The system consists of three main parts that run independently:

1.  **GPU Miners (`/solana-miner`, `/evm-miner`):** Dockerized, high-performance miners designed to be deployed on GPU cloud services like RunPod. They find vanity keypairs and submit them to the API.
2.  **Factory API (`/api`):** A Node.js/Express application that serves as the central hub. It receives new keypairs from miners, encrypts them using AWS KMS, and stores them in a PostgreSQL database.
3.  **PostgreSQL Database:** The secure vault for storing encrypted keypairs.

All backend services (API + DB) can be launched locally for development using Docker Compose.

---

## Prerequisites

Before you begin, you will need the following installed:

*   [Docker](https://www.docker.com/products/docker-desktop/) and Docker Compose
*   [Node.js](https://nodejs.org/en/) (v18 or later)
*   [AWS CLI](https://aws.amazon.com/cli/), configured with your credentials (`aws configure`)

---

## Local Development Setup

1.  **Clone the repository:**
    ```bash
    git clone [URL_OF_YOUR_REPO]
    cd vanity-factory
    ```

2.  **Set up AWS KMS:**
    *   Follow the AWS documentation to create a new symmetric KMS Key.
    *   Note the **Key ID**.
    *   Ensure your AWS user/role has `kms:GenerateDataKey` and `kms:Decrypt` permissions for this key.

3.  **Configure Environment Variables:**
    *   Navigate to the `/api` directory.
    *   Copy the example environment file:
        ```bash
        cp .env.example .env
        ```
    *   Edit the `.env` file and fill in all the required values (Database URL, a new worker key, and your AWS details).

4.  **Install API Dependencies:**
    ```bash
    cd api
    npm install
    cd ..
    ```

5.  **Launch the Backend (API + Database):**
    *   From the root `vanity-factory` directory, run:
        ```bash
        docker-compose up --build
        ```
    *   This will build the API container and start both the API and the PostgreSQL database. The API will be available at `http://localhost:3000`.

6.  **Initialize the Database:**
    *   The database will be automatically initialized on first startup using the SQL script in `/db/init/001_init.sql`.
    *   The script creates the `vanity_keys` table with appropriate indexes for optimal query performance.
    *   You can verify the table was created by connecting to the database:
        ```bash
        docker exec -it arcademinter-db-1 psql -U user -d vanitydb -c "\dt"
        ```

---

## API Endpoints

### `POST /api/v1/submit_keypair`
Submits a new vanity keypair to the database (requires worker API key authentication).

**Headers:**
- `x-api-key`: Your worker API key
- `Content-Type`: application/json

**Request Body:**
```json
{
  "publicKey": "string",
  "privateKey": "string",
  "network": "solana|evm"
}
```

**Response:**
```json
{
  "success": true,
  "publicKey": "string"
}
```

### `GET /api/v1/request_address?pattern=xxx`
Requests an available address with the specified pattern (platform authentication required).

**Query Parameters:**
- `pattern`: The 3-character pattern to search for (e.g., "abc")

**Response:**
```json
{
  "publicKey": "string"
}
```

### `POST /api/v1/claim_address`
Claims an assigned address and retrieves its private key (platform authentication required). The keypair is deleted from the database after claiming.

**Request Body:**
```json
{
  "publicKey": "string"
}
```

**Response:**
```json
{
  "privateKey": "string"
}
```

---

## Architecture Notes

- **Envelope Encryption:** Private keys are encrypted using AWS KMS envelope encryption before storage.
- **Concurrency Safety:** The `request_address` endpoint uses PostgreSQL's `FOR UPDATE SKIP LOCKED` to prevent race conditions.
- **Automatic Cleanup:** Claimed keypairs are immediately purged from the database for security.

---

## Security Considerations

1. **Worker API Key:** Generate a strong random key and keep it secure. Never commit the `.env` file to version control.
2. **AWS KMS Permissions:** Ensure your AWS user/role has only the minimum required permissions (`kms:GenerateDataKey`, `kms:Decrypt`).
3. **Platform Authentication:** The `requirePlatformAuth` middleware is currently a placeholder. Implement proper authentication before deploying to production.
4. **Database Access:** In production, do not expose the database port publicly. Use private networking or VPC peering.

---

## Local Development Tips

- **View Logs:**
  ```bash
  docker-compose logs -f api
  docker-compose logs -f db
  ```

- **Restart Services:**
  ```bash
  docker-compose restart api
  ```

- **Stop All Services:**
  ```bash
  docker-compose down
  ```

- **Reset Database:**
  ```bash
  docker-compose down -v
  docker-compose up --build
  ```


