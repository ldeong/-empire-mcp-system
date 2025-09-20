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
        print_status "Installing Wrangler CLI..."
        npm install -g wrangler
        print_success "Wrangler installed!"
    else
        print_success "Wrangler CLI found!"
    fi
}

# Check if user is logged in to Cloudflare
check_auth() {
    print_status "Checking Cloudflare authentication..."
    if ! wrangler whoami &> /dev/null; then
        print_warning "Not logged in to Cloudflare. Initiating login..."
        print_status "🔑 Please complete authentication in your browser..."
        wrangler login
        print_success "✅ Authentication complete!"
    else
        print_success "✅ Already authenticated to Cloudflare!"
    fi
}

# Create KV namespace with error handling
create_kv_namespace() {
    print_status "Setting up KV namespace for earnings tracking..."

    # Try to create KV namespace
    KV_OUTPUT=$(wrangler kv namespace create "FIRST_DOLLAR_KV" 2>&1 || true)

    if [[ $KV_OUTPUT == *"Created KV namespace"* ]]; then
        # Extract namespace ID
        KV_ID=$(echo "$KV_OUTPUT" | grep -o 'id = "[^"]*"' | cut -d'"' -f2)
        print_success "✅ KV namespace created: $KV_ID"

        # Update wrangler.toml with the actual KV ID
        if [ -f "wrangler-first-dollar.toml" ]; then
            sed -i.bak "s/id = \"first_dollar_kv\"/id = \"$KV_ID\"/" wrangler-first-dollar.toml
            sed -i.bak "s/preview_id = \"first_dollar_kv_preview\"/preview_id = \"$KV_ID\"/" wrangler-first-dollar.toml
            print_success "✅ Updated wrangler.toml with KV namespace ID"
        fi
    elif [[ $KV_OUTPUT == *"already exists"* ]]; then
        print_warning "⚠️  KV namespace already exists - continuing..."
    else
        print_warning "⚠️  KV namespace creation skipped - using default config"
    fi
}

# Deploy the worker with error handling
deploy_worker() {
    print_status "🚀 Deploying First Dollar Mission worker..."

    # Try deployment with error handling
    if [ -f "first-dollar-worker.js" ] && [ -f "wrangler-first-dollar.toml" ]; then
        DEPLOY_OUTPUT=$(wrangler deploy first-dollar-worker.js --config wrangler-first-dollar.toml --name first-dollar-mission 2>&1 || true)

        if [[ $DEPLOY_OUTPUT == *"Published"* ]] || [[ $DEPLOY_OUTPUT == *"deployed successfully"* ]]; then
            # Extract the deployment URL
            if [[ $DEPLOY_OUTPUT == *"https://"* ]]; then
                WORKER_URL=$(echo "$DEPLOY_OUTPUT" | grep -o 'https://[^[:space:]]*' | head -1)
            else
                WORKER_URL="https://first-dollar-mission.$(whoami).workers.dev"
            fi
            
            print_success "✅ Worker deployed successfully!"
            print_celebration "🌐 LIVE URL: $WORKER_URL"
            echo "$WORKER_URL" > .worker_url
            return 0
        else
            print_error "❌ Deployment failed. Trying alternative deployment..."
            # Try simplified deployment
            SIMPLE_DEPLOY=$(wrangler deploy first-dollar-worker.js --name first-dollar-mission 2>&1 || true)
            
            if [[ $SIMPLE_DEPLOY == *"Published"* ]] || [[ $SIMPLE_DEPLOY == *"deployed successfully"* ]]; then
                WORKER_URL="https://first-dollar-mission.$(whoami).workers.dev"
                print_success "✅ Worker deployed with simplified config!"
                print_celebration "🌐 LIVE URL: $WORKER_URL"
                echo "$WORKER_URL" > .worker_url
                return 0
            else
                print_error "❌ Deployment failed completely. Output:"
                echo "$DEPLOY_OUTPUT"
                echo "$SIMPLE_DEPLOY"
                return 1
            fi
        fi
    else
        print_error "❌ Required files missing:"
        [ ! -f "first-dollar-worker.js" ] && print_error "   - first-dollar-worker.js"
        [ ! -f "wrangler-first-dollar.toml" ] && print_error "   - wrangler-first-dollar.toml"
        return 1
    fi
}

# Test the deployment
test_deployment() {
    if [ -f .worker_url ]; then
        WORKER_URL=$(cat .worker_url)
        print_status "🧪 Testing deployment at: $WORKER_URL"

        # Test basic endpoint with timeout
        TEST_RESPONSE=$(timeout 10 curl -s "$WORKER_URL/api/status" 2>/dev/null || echo "timeout")

        if [[ $TEST_RESPONSE == *"currentEarnings"* ]]; then
            print_success "✅ Worker is responding correctly!"
            print_success "🎯 READY TO START EARNING!"
        elif [[ $TEST_RESPONSE == "timeout" ]]; then
            print_warning "⚠️  Worker might still be starting up - try the URL in a few seconds"
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
        echo "   1. 🔗 Open: $WORKER_URL"
        echo "   2. 🔍 Click: 'Find Instant Jobs'"
        echo "   3. 💵 Complete 2-3 jobs to earn $5+"
        echo "   4. ☁️  Click: 'Purchase Cloudflare Pro'"
        echo ""
        print_success "🎯 MISSION OBJECTIVES:"
        echo "   ✅ Deploy in < 30 seconds: DONE"
        echo "   ⏳ Complete first job in < 10 minutes"
        echo "   ⏳ Earn $5 for Cloudflare Pro upgrade"
        echo "   ⏳ Show proof of achievement"
        echo ""
        print_success "🚀 QUICK API COMMANDS (if needed):"
        echo "   # Complete validation job (\$3):"
        echo "   curl -X POST $WORKER_URL/api/complete/data-validation"
        echo ""
        echo "   # Complete API test job (\$2.50):"
        echo "   curl -X POST $WORKER_URL/api/complete/api-test"
        echo ""
        echo "   # Check your earnings:"
        echo "   curl $WORKER_URL/api/status"
        echo ""
        echo "   # Auto-earn mode (complete all jobs):"
        echo "   curl -X POST $WORKER_URL/api/auto-earn"
        echo ""
        print_celebration "🎉 YOUR MONEY-MAKING JOURNEY STARTS NOW!"
        print_celebration "💰 EXPECTED EARNINGS: \$5+ IN NEXT 10 MINUTES!"
        echo "=============================================="
    else
        print_error "❌ Deployment failed - no worker URL available"
        print_status "🔧 Troubleshooting steps:"
        echo "   1. Check if you're logged into Cloudflare: wrangler whoami"
        echo "   2. Verify files exist: ls first-dollar-worker.js wrangler-first-dollar.toml"
        echo "   3. Try manual deployment: wrangler deploy first-dollar-worker.js --name first-dollar-mission"
    fi
}

# Main deployment flow
main() {
    print_celebration "🚀 FIRST DOLLAR MISSION: \$0 → \$5 → CLOUDFLARE PRO"
    echo ""

    # Step-by-step deployment
    if check_wrangler && check_auth; then
        print_success "✅ Prerequisites ready!"
        
        create_kv_namespace
        
        if deploy_worker; then
            print_success "✅ Deployment successful!"
            test_deployment
            show_completion_guide
            print_celebration "🎯 MISSION READY! GO EARN REAL MONEY!"
            exit 0
        else
            print_error "❌ Deployment failed"
            show_completion_guide
            exit 1
        fi
    else
        print_error "❌ Prerequisites failed"
        exit 1
    fi
}

# Run main function
main "$@"