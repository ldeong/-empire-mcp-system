#!/bin/bash

# SINA Empire Hyperdrive Setup Script
# Enhanced database performance for crypto gateway

echo "🚀 Setting up Hyperdrive configurations for SINA Empire..."

# Set the API token
export CLOUDFLARE_API_TOKEN="N5Tc_ANSt4J31gDZzgt2sGUjwhvSsdZOKcMIo6sS"

cd /workspaces/-empire-mcp-system

# Create Hyperdrive configuration for crypto operations
echo "📊 Creating crypto operations Hyperdrive..."
wrangler hyperdrive create sina-crypto-hyperdrive \
  --connection-string "postgresql://crypto_user:secure_password@crypto-db.internal:5432/crypto_operations" \
  --max-size 20 \
  --max-age 60

# Create Hyperdrive configuration for analytics
echo "📈 Creating analytics Hyperdrive..."
wrangler hyperdrive create sina-analytics-hyperdrive \
  --connection-string "postgresql://analytics_user:secure_password@analytics-db.internal:5432/sina_analytics" \
  --max-size 15 \
  --max-age 120

# Create KV namespaces
echo "🔑 Creating KV namespaces..."
wrangler kv:namespace create "CACHE" || echo "CACHE namespace already exists"
wrangler kv:namespace create "SESSIONS" || echo "SESSIONS namespace already exists"

# Create R2 bucket
echo "📦 Creating R2 bucket..."
wrangler r2 bucket create sina-empire-storage || echo "R2 bucket already exists"

echo "✅ Hyperdrive setup complete!"
echo "🌐 Gateway URL: https://sina-empire-crypto-gateway.louiewong4.workers.dev"
echo "🔗 Dashboard: https://dash.cloudflare.com/fb05ba58cf4b46f19221514cfb75ab61/workers/services/view/sina-empire-crypto-gateway"