#!/bin/bash
# 🚀 Deploy the SINA Empire Escrow-to-Scale Worker

set -e

echo "🚀 Deploying Escrow-to-Scale Worker..."

# Use wrangler to deploy the new worker
npx wrangler deploy src/escrow-to-scale-worker.js --name sina-escrow-empire

echo "✅ Escrow-to-Scale Worker deployed!"
echo "🌐 Access at: https://sina-escrow-empire.YOUR-SUBDOMAIN.workers.dev"
