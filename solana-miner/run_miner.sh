#!/bin/bash
API_URL="http://YOUR_API_IP:3000/api/v1/submit_keypair"
WORKER_API_KEY="SUPER_SECRET_KEY_CHANGE_ME"
SUFFIX="arc"
echo "Starting Solana miner for suffix: $SUFFIX"
solanity --suffix --case-insensitive "$SUFFIX" | while read -r line ; do
    echo "Found Potential Keypair: $line"
    PUBKEY=$(echo "$line" | grep -o -E '[1-9A-HJ-NP-Za-km-z]{32,44}' | head -n 1)
    PRIVKEY=$(echo "$line" | grep -o -E '[1-9A-HJ-NP-Za-km-z]{32,44}' | tail -n 1)
    if [ -n "$PUBKEY" ] && [ -n "$PRIVKEY" ]; then
        echo "Submitting to API..."
        curl -X POST "$API_URL" \
             -H "Content-Type: application/json" \
             -H "x-api-key: $WORKER_API_KEY" \
             -d "{
                   \"publicKey\": \"$PUBKEY\",
                   \"privateKey\": \"$PRIVKEY\",
                   \"network\": \"solana\"
                 }"
    fi
done

