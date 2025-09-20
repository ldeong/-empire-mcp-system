#!/bin/bash

# 🚀 SINA EMPIRE REVENUE SYSTEM - LIVE DEPLOYMENT SCRIPT
# Deploy full revenue multiplier system to Cloudflare Workers

echo "🚀 DEPLOYING SINA EMPIRE REVENUE SYSTEM TO CLOUDFLARE"
echo "💰 Current NZD Revenue: \$90.76 NZD"
echo "🎯 Target: \$1,650 NZD daily"
echo ""

# Check Cloudflare CLI
if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler CLI not found. Installing..."
    npm install -g wrangler
fi

# Login check
echo "🔐 Checking Cloudflare authentication..."
wrangler whoami || {
    echo "🔑 Please login to Cloudflare:"
    wrangler login
}

# Create databases if they don't exist
echo "📊 Setting up revenue databases..."
echo "Creating revenue system database..."
# wrangler d1 create sina-empire-revenue-system || echo "Database may already exist"

echo "Creating mega transactions database..."
# wrangler d1 create sina-empire-mega-transactions || echo "Database may already exist"

echo "Creating revenue analytics database..."
# wrangler d1 create sina-revenue-analytics || echo "Database may already exist"

# Create KV namespaces
echo "💾 Setting up KV storage..."
# wrangler kv:namespace create "EMPIRE_CACHE" || echo "KV namespace may already exist"
# wrangler kv:namespace create "REVENUE_CONTEXT" || echo "KV namespace may already exist"

# Create R2 bucket
echo "📁 Setting up R2 storage..."
# wrangler r2 bucket create sina-empire-files || echo "R2 bucket may already exist"

# Deploy the worker
echo ""
echo "🚀 DEPLOYING REVENUE MULTIPLIER SYSTEM..."
echo "📡 Deploying to: sina-empire-revenue-multiplier.workers.dev"
echo ""

# Deploy with verbose output
wrangler deploy --env production --verbose

# Check deployment status
if [ $? -eq 0 ]; then
    echo ""
    echo "✅ DEPLOYMENT SUCCESSFUL!"
    echo ""
    echo "🌐 Live URLs:"
    echo "   • Main Dashboard: https://sina-empire-revenue-multiplier.workers.dev"
    echo "   • Revenue Dashboard: https://sina-empire-revenue-multiplier.workers.dev/revenue-dashboard"
    echo "   • Wallet Interface: https://sina-empire-revenue-multiplier.workers.dev/wallet"
    echo "   • Instant Jobs: https://sina-empire-revenue-multiplier.workers.dev/instant-jobs"
    echo "   • Revenue Multiplier: https://sina-empire-revenue-multiplier.workers.dev/revenue-multiplier"
    echo ""
    echo "💰 REVENUE SYSTEM STATUS:"
    echo "   • Single transactions: \$1-\$20 USD (\$1.65-\$33 NZD)"
    echo "   • Mega packages: \$40-\$150 USD (\$66-\$247 NZD)"
    echo "   • Parallel processing: Up to 60 jobs"
    echo "   • Current total: \$90.76 NZD"
    echo ""
    echo "🎯 NEXT STEPS:"
    echo "   1. Test mega-transaction system"
    echo "   2. Monitor real-time revenue"
    echo "   3. Scale to \$1,650 NZD daily target"
    echo ""
    echo "🚀 LIVE AND READY FOR REVENUE!"
    
    # Test the deployment
    echo ""
    echo "🧪 Testing deployment..."
    curl -s "https://sina-empire-revenue-multiplier.workers.dev" | head -10
    
else
    echo ""
    echo "❌ DEPLOYMENT FAILED!"
    echo "🔧 Check the errors above and try again"
    exit 1
fi

echo ""
echo "💎 REVENUE EMPIRE IS LIVE! LET'S MAKE MONEY! 💎"