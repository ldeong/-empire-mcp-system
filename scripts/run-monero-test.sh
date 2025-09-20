#!/usr/bin/env bash
# Run a simulated Monero test payout against the deployed worker.
# Usage: ADMIN_TOKEN=yourtoken ./scripts/run-monero-test.sh <MONERO_ADDRESS> <AMOUNT>
# If ADMIN_TOKEN is not set, you will be prompted to paste it (stdin hidden when possible).

WORKER_URL="https://sina-empire-revenue-multiplier.louiewong4.workers.dev"

if [ -z "$1" ] || [ -z "$2" ]; then
  echo "Usage: ADMIN_TOKEN=yourtoken ./scripts/run-monero-test.sh <MONERO_ADDRESS> <AMOUNT>"
  exit 1
fi

TO="$1"
AMOUNT="$2"

if [ -z "$ADMIN_TOKEN" ]; then
  # Try read hidden
  if [ -t 0 ]; then
    echo -n "Enter ADMIN_TOKEN (input hidden): " >&2
    read -s ADMIN_TOKEN
    echo >&2
  else
    echo "Please set ADMIN_TOKEN env var before running this script." >&2
    exit 1
  fi
fi

curl -s -X POST "$WORKER_URL/api/admin/monero-test-payout" \
  -H "Content-Type: application/json" \
  -H "x-admin-token: $ADMIN_TOKEN" \
  -d "{\"to\":\"$TO\",\"amount\":$AMOUNT}" | jq .
