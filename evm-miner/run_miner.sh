#!/usr/bin/env bash
set -euo pipefail

API_URL="${API_URL:?Set API_URL to the factory submit_keypair endpoint}"
WORKER_API_KEY="${WORKER_API_KEY:?Set WORKER_API_KEY at runtime}"
SUFFIX="${SUFFIX:-arc}"

echo "Starting EVM vanity miner for suffix: ${SUFFIX}"

/usr/local/bin/profanity2 --matching "$SUFFIX" | while read -r line; do
  ADDRESS=$(printf '%s\n' "$line" | grep -o -E '0x[a-fA-F0-9]{40}' | head -n 1 || true)
  PRIVKEY=$(printf '%s\n' "$line" | grep -o -E '[a-fA-F0-9]{64}' | tail -n 1 || true)

  if [[ -n "$ADDRESS" && -n "$PRIVKEY" ]]; then
    # Never echo the miner's raw output: it may contain private-key material.
    echo "Submitting generated address ${ADDRESS}"
    curl --fail-with-body --silent --show-error \
      -X POST "$API_URL" \
      -H 'Content-Type: application/json' \
      -H "x-api-key: $WORKER_API_KEY" \
      -d "{\"publicKey\":\"$ADDRESS\",\"privateKey\":\"$PRIVKEY\",\"network\":\"evm\"}"
    printf '\n'
  fi
done
