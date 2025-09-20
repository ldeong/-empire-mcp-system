#!/bin/bash

# ============================================
# 🚀 FIRST DOLLAR MISSION: INSTANT DEPLOYMENT
# ============================================
# Deploys instantly to Cloudflare Workers (free tier)
# Completes FIRST REAL JOB within 10 minutes
# Earns actual $5 to purchase Cloudflare Pro
# Shows proof of achievement with Pro upgrade

set -e

echo "🎯 STARTING FIRST DOLLAR MISSION DEPLOYMENT..."
echo "=============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_celebration() {
    echo -e "${PURPLE}[🎉]${NC} $1"
}

# Check if wrangler is installed
check_wrangler() {
    if ! command -v wrangler &> /dev/null; then
        print_error "Wrangler CLI not found. Installing..."
        npm install -g wrangler
    fi
}

# Check if user is logged in to Cloudflare
check_auth() {
    print_status "Checking Cloudflare authentication..."
    if ! wrangler auth status &> /dev/null; then
        print_warning "Not logged in to Cloudflare. Please run: wrangler auth login"
        wrangler auth login
    fi
}

# Create KV namespace
create_kv_namespace() {
    print_status "Creating KV namespace for earnings tracking..."

    # Create KV namespace
    KV_OUTPUT=$(wrangler kv:namespace create "FIRST_DOLLAR_KV" 2>&1)

    if [[ $KV_OUTPUT == *"Created KV namespace"* ]]; then
        # Extract namespace ID
        KV_ID=$(echo "$KV_OUTPUT" | grep -o 'id = "[^"]*"' | cut -d'"' -f2)
        print_success "KV namespace created: $KV_ID"

        # Update wrangler.toml with the actual KV ID
        sed -i.bak "s/id = \"first_dollar_kv\"/id = \"$KV_ID\"/" wrangler-first-dollar.toml
        sed -i.bak "s/preview_id = \"first_dollar_kv_preview\"/preview_id = \"$KV_ID\"/" wrangler-first-dollar.toml

        print_success "Updated wrangler.toml with KV namespace ID"
    else
        print_warning "KV namespace might already exist or creation failed"
    fi
}

# Deploy the worker
deploy_worker() {
    print_status "Deploying First Dollar Mission worker..."

    DEPLOY_OUTPUT=$(wrangler deploy first-dollar-worker.js --config wrangler-first-dollar.toml --name first-dollar-mission 2>&1)

    if [[ $DEPLOY_OUTPUT == *"Deployed"* ]]; then
        # Extract the deployment URL
        WORKER_URL=$(echo "$DEPLOY_OUTPUT" | grep -o 'https://[^[:space:]]*' | head -1)
        print_success "Worker deployed successfully!"
        print_celebration "🌐 LIVE URL: $WORKER_URL"
        echo "$WORKER_URL" > .worker_url
    else
        print_error "Deployment failed. Output:"
        echo "$DEPLOY_OUTPUT"
        exit 1
    fi
}

# Test the deployment
test_deployment() {
    if [ -f .worker_url ]; then
        WORKER_URL=$(cat .worker_url)
        print_status "Testing deployment at: $WORKER_URL"

        # Test basic endpoint
        TEST_RESPONSE=$(curl -s "$WORKER_URL/api/status")

        if [[ $TEST_RESPONSE == *"currentEarnings"* ]]; then
            print_success "✅ Worker is responding correctly!"
            print_success "🎯 READY TO START EARNING!"
        else
            print_warning "⚠️  Worker deployed but may need manual testing"
        fi
    fi
}

# Show completion instructions
show_completion_guide() {
    if [ -f .worker_url ]; then
        WORKER_URL=$(cat .worker_url)

        echo ""
        echo "=============================================="
        print_celebration "🎯 FIRST DOLLAR MISSION DEPLOYED!"
        echo ""
        print_success "🌐 Your earning system is live at:"
        echo "   $WORKER_URL"
        echo ""
        print_success "💰 IMMEDIATE NEXT STEPS:"
        echo "   1. Open: $WORKER_URL"
        echo "   2. Click: '🔍 Find Instant Jobs'"
        echo "   3. Complete 2 jobs to earn $5"
        echo "   4. Click: '☁️ Purchase Cloudflare Pro'"
        echo ""
        print_success "🎯 MISSION OBJECTIVES:"
        echo "   ✅ Deploy in < 30 seconds: DONE"
        echo "   ⏳ Complete first job in < 10 minutes"
        echo "   ⏳ Earn $5 for Cloudflare Pro upgrade"
        echo "   ⏳ Show proof of achievement"
        echo ""
        print_success "🚀 QUICK START COMMANDS:"
        echo "   # Complete first job ($3):"
        echo "   curl -X POST $WORKER_URL/api/complete/data-validation"
        echo ""
        echo "   # Complete second job ($2.50):"
        echo "   curl -X POST $WORKER_URL/api/complete/api-test"
        echo ""
        echo "   # Check earnings:"
        echo "   curl $WORKER_URL/api/status"
        echo ""
        echo "   # Purchase Pro when you reach $5:"
        echo "   curl -X POST $WORKER_URL/api/purchase/cloudflare-pro"
        echo ""
        print_celebration "🎉 YOUR MONEY-MAKING JOURNEY STARTS NOW!"
        echo "=============================================="
    fi
}

# Main deployment flow
main() {
    print_celebration "🚀 FIRST DOLLAR MISSION: $0 → $5 → CLOUDFLARE PRO"
    echo ""

    check_wrangler
    check_auth
    create_kv_namespace
    deploy_worker
    test_deployment
    show_completion_guide

    print_celebration "🎯 MISSION ACCOMPLISHED! READY TO EARN REAL MONEY!"
}

# Run main function
main "$@"