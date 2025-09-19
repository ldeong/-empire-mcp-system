#!/usr/bin/env bash
# Usage: ./scripts/set_wrangler_secrets.sh secret_name secret_value
# This uses `wrangler secret put` to set secrets for a Cloudflare Worker. Requires wrangler configured.

if [ "$#" -ne 2 ]; then
  echo "Usage: $0 SECRET_NAME SECRET_VALUE"
  exit 1
fi

SECRET_NAME=$1
SECRET_VALUE=$2

if ! command -v wrangler &> /dev/null; then
  echo "wrangler not found. Install with: npm install -g wrangler"
  exit 1
fi

echo "$SECRET_VALUE" | wrangler secret put "$SECRET_NAME"

echo "Wrangler secret $SECRET_NAME set."
