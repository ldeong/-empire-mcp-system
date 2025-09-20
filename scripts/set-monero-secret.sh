#!/usr/bin/env bash
# Helper to set MONERO_WALLET_JSON secret for Cloudflare Workers using wrangler
# Designed to help users (including blind users) add the secret via stdin.

# Usage:
#   cat monero_wallet.json | ./scripts/set-monero-secret.sh
# or interactively:
#   ./scripts/set-monero-secret.sh

CONFIG="./wrangler-fixed.toml"
ENV_ARG=""

if [ -n "$1" ]; then
  CONFIG="$1"
fi

# If stdin is a terminal, prompt the user to paste the JSON and press Ctrl-D when done.
if [ -t 0 ]; then
  echo "Please paste your MONERO_WALLET_JSON now. Press Ctrl-D when finished." >&2
  SECRET_JSON=$(cat)
else
  # Read from pipe
  SECRET_JSON=$(cat -)
fi

if [ -z "$SECRET_JSON" ]; then
  echo "No input received. Aborting." >&2
  exit 1
fi

# Use wrangler to put the secret. This will not echo the secret back.
# If you need to target an environment, pass --env production after --config in the command below.

printf "%s" "$SECRET_JSON" | npx wrangler secret put MONERO_WALLET_JSON --config "$CONFIG"

if [ $? -eq 0 ]; then
  echo "MONERO_WALLET_JSON secret set successfully." >&2
  echo "Next: run 'npx wrangler deploy --config $CONFIG' to deploy your worker with the secret." >&2
else
  echo "Failed to set MONERO_WALLET_JSON secret. Check wrangler configuration and try again." >&2
fi
