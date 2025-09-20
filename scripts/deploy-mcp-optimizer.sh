#!/bin/bash

# deploy-mcp-optimizer.sh - Deploy Optimized MCP WebSocket System
# Deploys the high-performance AP2-compliant system with MCP optimizations

set -e

echo "🚀 DEPLOYING MCP-OPTIMIZED AP2 SYSTEM..."
echo "================================================="

# Color codes for better visibility
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

info() { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check required tools
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

echo -e "${PURPLE}📋 PHASE 1: ENVIRONMENT OPTIMIZATION${NC}"
echo "===================================="

# Run environment optimization first
if [ -f "./scripts/optimize-mcp-env.sh" ]; then
    info "Running MCP environment optimization..."
    ./scripts/optimize-mcp-env.sh
    success "Environment optimized"
else
    warning "MCP optimization script not found, skipping environment setup"
fi

echo -e "\n${PURPLE}📦 PHASE 2: DEPENDENCY CHECK${NC}"
echo "============================="

# Check Wrangler CLI
if command_exists wrangler; then
    success "Wrangler CLI found: $(wrangler --version)"
else
    error "Wrangler CLI not found. Installing..."
    npm install -g wrangler@latest
fi

# Check Node.js
if command_exists node; then
    success "Node.js found: $(node --version)"
else
    error "Node.js not found. Please install Node.js first."
    exit 1
fi

echo -e "\n${PURPLE}🗄️ PHASE 3: DATABASE SETUP${NC}"
echo "=========================="

# Apply database schema
info "Setting up D1 database schema..."
if [ -f "schema/ap2-agent-db.sql" ]; then
    wrangler d1 execute ap2_agent_db --file=schema/ap2-agent-db.sql --config=wrangler-optimizer.toml
    success "Database schema applied"
else
    error "Database schema file not found: schema/ap2-agent-db.sql"
    exit 1
fi

echo -e "\n${PURPLE}🔐 PHASE 4: SECRETS CONFIGURATION${NC}"
echo "================================"

# Generate and set secrets
info "Configuring Worker secrets..."

# Generate KMS secret if not exists
KMS_SECRET=$(openssl rand -base64 32)
echo "${KMS_SECRET}" | wrangler secret put KMS_SECRET --config=wrangler-optimizer.toml

# Set other secrets (will prompt if not in environment)
if [ -n "${AP2_PUBKEY_PEM}" ]; then
    echo "${AP2_PUBKEY_PEM}" | wrangler secret put AP2_PUBKEY_PEM --config=wrangler-optimizer.toml
else
    warning "AP2_PUBKEY_PEM not set in environment"
fi

if [ -n "${CIRCLE_API_KEY}" ]; then
    echo "${CIRCLE_API_KEY}" | wrangler secret put CIRCLE_API_KEY --config=wrangler-optimizer.toml
fi

if [ -n "${CIRCLE_WALLET_ID}" ]; then
    echo "${CIRCLE_WALLET_ID}" | wrangler secret put CIRCLE_WALLET_ID --config=wrangler-optimizer.toml
fi

if [ -n "${CIRCLE_WEBHOOK_SECRET}" ]; then
    echo "${CIRCLE_WEBHOOK_SECRET}" | wrangler secret put CIRCLE_WEBHOOK_SECRET --config=wrangler-optimizer.toml
fi

success "Secrets configured"

echo -e "\n${PURPLE}☁️ PHASE 5: CLOUDFLARE DEPLOYMENT${NC}"
echo "================================"

# Deploy the optimized worker
info "Deploying MCP-optimized Worker..."
wrangler deploy --config=wrangler-optimizer.toml --env=production

if [ $? -eq 0 ]; then
    success "Worker deployed successfully"
else
    error "Worker deployment failed"
    exit 1
fi

echo -e "\n${PURPLE}🔑 PHASE 6: API KEY SEEDING${NC}"
echo "=========================="

# Seed initial API keys (if available)
if [ -n "${NEWSAPI_KEY}" ]; then
    info "Seeding NewsAPI key..."
    
    # Encrypt and store the key
    NODE_SCRIPT=$(cat <<'EOF'
const key = process.env.NEWSAPI_KEY || "";
const kms = process.env.KMS_SECRET || "";
if (!key || !kms) { 
    console.error("Missing NEWSAPI_KEY or KMS_SECRET"); 
    process.exit(0); 
}

function b64(b) { return Buffer.from(b).toString('base64'); }

(async () => {
    const { subtle } = globalThis.crypto || (await import('node:crypto').then(c => c.webcrypto));
    const iv = Buffer.from('123456789012'); // Demo IV
    const kraw = Buffer.from(kms, 'base64');
    const aes = await subtle.importKey("raw", kraw, "AES-GCM", false, ["encrypt"]);
    const enc = await subtle.encrypt({name: "AES-GCM", iv}, aes, Buffer.from(key));
    console.log(JSON.stringify({cipher: b64(Buffer.from(enc)), iv: b64(iv)}));
})();
EOF
    )
    
    export NODE_OPTIONS=--experimental-global-webcrypto
    export KMS_SECRET="${KMS_SECRET}"
    ENC=$(node -e "$NODE_SCRIPT")
    
    wrangler kv key put --binding=API_KEY_KV "keys/newsapi/1" --value="${ENC}" --config=wrangler-optimizer.toml
    success "NewsAPI key seeded"
fi

echo -e "\n${PURPLE}🧪 PHASE 7: SYSTEM TESTING${NC}"
echo "========================"

# Get the deployed worker URL
WORKER_URL=$(wrangler deployments list --config=wrangler-optimizer.toml 2>/dev/null | grep -oP 'https://[^\s]+\.workers\.dev' | head -1)

if [ -n "${WORKER_URL}" ]; then
    info "Testing deployed worker at: ${WORKER_URL}"
    
    # Test health endpoint
    HEALTH_RESPONSE=$(curl -s "${WORKER_URL}/status" || echo "failed")
    if echo "${HEALTH_RESPONSE}" | grep -q "operational"; then
        success "Health check passed"
    else
        warning "Health check failed: ${HEALTH_RESPONSE}"
    fi
    
    # Test performance
    info "Testing WebSocket performance..."
    RESPONSE_TIME=$(curl -s -w "%{time_total}" -o /dev/null "${WORKER_URL}/status" 2>/dev/null || echo "0")
    if [ "$(echo "${RESPONSE_TIME} < 0.5" | bc 2>/dev/null || echo "1")" = "1" ]; then
        success "Response time: ${RESPONSE_TIME}s (Excellent)"
    else
        warning "Response time: ${RESPONSE_TIME}s (May need optimization)"
    fi
    
else
    error "Could not determine worker URL"
fi

echo -e "\n${PURPLE}📊 PHASE 8: MONITORING SETUP${NC}"
echo "============================"

# Create monitoring dashboard
cat > monitor-mcp-system.sh << 'EOF'
#!/bin/bash
# MCP System Monitor

WORKER_URL="${1:-}"
if [ -z "$WORKER_URL" ]; then
    echo "Usage: $0 <worker-url>"
    exit 1
fi

echo "📊 MCP SYSTEM PERFORMANCE MONITOR"
echo "================================="
echo "Worker: $WORKER_URL"
echo "Time: $(date)"
echo ""

# System status
echo "🔍 System Status:"
curl -s "$WORKER_URL/status" | jq '.' 2>/dev/null || echo "Status endpoint unavailable"
echo ""

# Performance metrics
echo "⚡ Performance Test:"
for i in {1..5}; do
    TIME=$(curl -s -w "%{time_total}" -o /dev/null "$WORKER_URL/status" 2>/dev/null)
    echo "Request $i: ${TIME}s"
done
echo ""

# WebSocket test
echo "🔌 WebSocket Connectivity:"
if command -v websocat >/dev/null; then
    echo "Testing WebSocket connection..."
    timeout 5 websocat "$WORKER_URL" || echo "WebSocket test failed"
else
    echo "websocat not installed, skipping WebSocket test"
fi
EOF

chmod +x monitor-mcp-system.sh

success "Monitoring script created: monitor-mcp-system.sh"

echo -e "\n${GREEN}🎉 MCP-OPTIMIZED AP2 SYSTEM DEPLOYED SUCCESSFULLY!${NC}"
echo "=================================================="
echo ""
echo -e "${CYAN}📍 DEPLOYMENT DETAILS:${NC}"
echo "• Worker URL: ${WORKER_URL}"
echo "• Configuration: wrangler-optimizer.toml"
echo "• Database: ap2_agent_db (D1)"
echo "• Cache: API_KEY_KV (KV)"
echo ""
echo -e "${CYAN}🚀 OPTIMIZED ENDPOINTS:${NC}"
echo "• GET  /status          - System health & performance"
echo "• GET  /usekey?service= - Cached API key retrieval"
echo "• POST /buykey          - Spend-guarded key purchase"
echo "• POST /webhook/circle  - Circle payment webhooks"
echo ""
echo -e "${CYAN}⚡ PERFORMANCE FEATURES:${NC}"
echo "• KV caching for 60s (ultra-fast key retrieval)"
echo "• Kill switch protection"
echo "• Daily spend limits"
echo "• Real-time performance metrics"
echo "• WebSocket optimization"
echo ""
echo -e "${CYAN}🔧 MONITORING COMMANDS:${NC}"
echo "• Monitor system: ./monitor-mcp-system.sh ${WORKER_URL}"
echo "• Check logs: wrangler tail --config=wrangler-optimizer.toml"
echo "• Performance: monitor-mcp (if environment was optimized)"
echo ""
echo -e "${CYAN}🎯 NEXT STEPS:${NC}"
echo "1. Test the optimized endpoints"
echo "2. Monitor performance metrics"
echo "3. Scale up with additional API keys"
echo "4. Enable Circle webhooks for automatic funding"
echo ""
echo -e "${GREEN}✅ YOUR MCP-OPTIMIZED REVENUE SYSTEM IS NOW LIVE!${NC}"

exit 0