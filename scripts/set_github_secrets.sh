#!/usr/bin/env bash
# Usage: ./scripts/set_github_secrets.sh owner repo
# Requires: gh CLI (https://cli.github.com/) authenticated

set -e
OWNER=${1:-your-username}
REPO=${2:-your-repo}

read -p "Enter secret name (e.g. CLOUDFLARE_API_TOKEN): " SECRET_NAME
read -s -p "Enter secret value: " SECRET_VALUE
echo

if ! command -v gh &> /dev/null; then
  echo "gh CLI not found. Install from https://cli.github.com/"
  exit 1
fi

echo "Setting secret $SECRET_NAME on $OWNER/$REPO"
# Use gh to set secret
echo "$SECRET_VALUE" | gh secret set "$SECRET_NAME" -R "$OWNER/$REPO" --body -

echo "Secret set."
