#!/bin/bash

# First Dollar Mission - Cloudflare Workers Deployment Script
# This script deploys the autonomous income generation system to Cloudflare Workers

set -e

echo "🚀 First Dollar Mission - Cloudflare Workers Deployment"
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

# Check if wrangler is installed
check_wrangler() {
    if ! command -v wrangler &> /dev/null; then
        print_error "Wrangler CLI is not installed."
        print_status "Installing Wrangler CLI..."
        npm install -g wrangler
        print_success "Wrangler CLI installed successfully."
    else
        print_success "Wrangler CLI is already installed."
    fi
}

# Check if user is logged in to Cloudflare
check_auth() {
    print_status "Checking Cloudflare authentication..."
    if ! wrangler auth status &> /dev/null; then
        print_warning "You are not logged in to Cloudflare."
        print_status "Please run: wrangler auth login"
        print_status "Or set CLOUDFLARE_API_TOKEN environment variable"
        exit 1
    else
        print_success "Cloudflare authentication verified."
    fi
}

# Create KV namespace
create_kv_namespace() {
    print_status "Creating KV namespace for earnings data..."

    # Check if namespace already exists
    if wrangler kv:namespace list | grep -q "first_dollar_earnings"; then
        print_warning "KV namespace 'first_dollar_earnings' already exists."
    else
        # Create production namespace
        KV_ID=$(wrangler kv:namespace create "first_dollar_earnings" 2>/dev/null | grep -o 'id = "[^"]*"' | cut -d'"' -f2)
        if [ -n "$KV_ID" ]; then
            print_success "KV namespace created with ID: $KV_ID"

            # Update wrangler.toml with the actual KV ID
            sed -i.bak "s/id = \"first_dollar_earnings\"/id = \"$KV_ID\"/" wrangler-first-dollar.toml
            print_success "Updated wrangler-first-dollar.toml with KV namespace ID."
        else
            print_error "Failed to create KV namespace."
            exit 1
        fi
    fi
}

# Deploy the worker
deploy_worker() {
    print_status "Deploying First Dollar Mission to Cloudflare Workers..."

    # Deploy using the specific config file
    if wrangler deploy --config wrangler-first-dollar.toml; then
        print_success "Worker deployed successfully!"

        # Get the deployment URL
        DEPLOY_URL=$(wrangler deploy --config wrangler-first-dollar.toml --dry-run 2>/dev/null | grep -o 'https://[^[:space:]]*' | head -1)
        if [ -n "$DEPLOY_URL" ]; then
            print_success "Your First Dollar Mission is live at: $DEPLOY_URL"
            print_success "Dashboard: $DEPLOY_URL"
            print_success "API Status: $DEPLOY_URL/api/status"
        fi
    else
        print_error "Worker deployment failed."
        exit 1
    fi
}

# Main deployment process
main() {
    print_status "Starting First Dollar Mission deployment process..."

    # Pre-deployment checks
    check_wrangler
    check_auth

    # Setup and deploy
    create_kv_namespace
    deploy_worker

    print_success "🎉 First Dollar Mission deployment completed!"
    print_status ""
    print_status "Next steps:"
    print_status "1. Visit your dashboard to start earning"
    print_status "2. Complete jobs to reach $5"
    print_status "3. Purchase Cloudflare Pro as proof of achievement"
    print_status ""
    print_status "Happy earning! 💰"
}

# Run main function
main "$@"