#!/bin/bash
API_URL="http://YOUR_API_IP:3000/api/v1/submit_keypair"
WORKER_API_KEY="SUPER_SECRET_KEY_CHANGE_ME"
SUFFIX="arc"
echo "Starting EVM miner for suffix: $SUFFIX"
/usr/local/bin/profanity2 --matching "$SUFFIX" | while read -r line ; do
    echo "Found Potential Keypair: $line"
    ADDRESS=$(echo "$line" | grep -o -E '0x[a-fA-F0-9]{40}')
    PRIVKEY=$(echo "$line" | grep -o -E '[a-fA-F0-9]{64}' | tail -n 1)
    if [ -n "$ADDRESS" ] && [ -n "$PRIVKEY" ]; then
        echo "Submitting to API..."
        curl -X POST "$API_URL" \
             -H "Content-Type: application/json" \
             -H "x-api-key: $WORKER_API_KEY" \
             -d "{
                   \"publicKey\": \"$ADDRESS\",
                   \"privateKey\": \"$PRIVKEY\",
                   \"network\": \"evm\"
                 }"
    fi
done

