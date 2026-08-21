#!/usr/bin/env bash
set -euo pipefail

API_URL="${API_URL:?Set API_URL to the factory submit_keypair endpoint}"
WORKER_API_KEY="${WORKER_API_KEY:?Set WORKER_API_KEY at runtime}"
SUFFIX="${SUFFIX:-arc}"

echo "Starting Solana vanity miner for suffix: ${SUFFIX}"

solanity --suffix --case-insensitive "$SUFFIX" | while read -r line; do
  PUBKEY=$(printf '%s\n' "$line" | grep -o -E '[1-9A-HJ-NP-Za-km-z]{32,44}' | head -n 1 || true)
  PRIVKEY=$(printf '%s\n' "$line" | grep -o -E '[1-9A-HJ-NP-Za-km-z]{32,128}' | tail -n 1 || true)

  if [[ -n "$PUBKEY" && -n "$PRIVKEY" ]]; then
    # Never echo the miner's raw output: it may contain private-key material.
    echo "Submitting generated address ${PUBKEY}"
    curl --fail-with-body --silent --show-error \
      -X POST "$API_URL" \
      -H 'Content-Type: application/json' \
      -H "x-api-key: $WORKER_API_KEY" \
      -d "{\"publicKey\":\"$PUBKEY\",\"privateKey\":\"$PRIVKEY\",\"network\":\"solana\"}"
    printf '\n'
  fi
done
