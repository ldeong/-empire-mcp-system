#!/bin/bash

# SINA EMPIRE AUTO-AUTH SCRIPT
# Automatically authenticates with Cloudflare for seamless development

export CLOUDFLARE_API_TOKEN=N5Tc_ANSt4J31gDZzgt2sGUjwhvSsdZOKcMIo6sS
export CLOUDFLARE_ACCOUNT_ID=YOUR_ACCOUNT_ID

echo "🔐 SINA Empire Auto-Auth Activated"
echo "✅ Cloudflare API Token Set"
echo "⚡ Ready for Wrangler Operations"

# Verify authentication
echo "🔍 Verifying Cloudflare Authentication..."
wrangler whoami

echo "🚀 Empire Development Environment Ready!"