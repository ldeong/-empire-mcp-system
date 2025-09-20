#!/bin/bash

# test-mcp-optimizations.sh - Test MCP WebSocket Optimizations
# Validates that the optimizations are working correctly

set -e

echo "🧪 TESTING MCP OPTIMIZATIONS..."
echo "==============================="

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

success() { echo -e "${GREEN}[PASS]${NC} $1"; }
fail() { echo -e "${RED}[FAIL]${NC} $1"; }
info() { echo -e "${BLUE}[INFO]${NC} $1"; }
warning() { echo -e "${YELLOW}[WARN]${NC} $1"; }

# Test results tracking
TESTS_PASSED=0
TESTS_FAILED=0

test_result() {
    if [ $1 -eq 0 ]; then
        success "$2"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        fail "$2"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
}

echo "📋 Test 1: Environment Optimization Check"
echo "----------------------------------------"

# Check system limits
NOFILE_LIMIT=$(ulimit -n)
if [ "$NOFILE_LIMIT" -ge 2048 ]; then
    test_result 0 "File descriptor limit: $NOFILE_LIMIT (Good)"
else
    test_result 1 "File descriptor limit: $NOFILE_LIMIT (Too low)"
fi

# Check if optimization script exists
if [ -f "./scripts/optimize-mcp-env.sh" ]; then
    test_result 0 "MCP environment optimization script exists"
else
    test_result 1 "MCP environment optimization script missing"
fi

echo ""
echo "📋 Test 2: Worker File Structure"
echo "-------------------------------"

# Check optimized worker exists
if [ -f "./src/optimizer-worker.js" ]; then
    test_result 0 "Optimized worker file exists"
else
    test_result 1 "Optimized worker file missing"
fi

# Check wrangler config
if [ -f "./wrangler-optimizer.toml" ]; then
    test_result 0 "Optimized wrangler config exists"
else
    test_result 1 "Optimized wrangler config missing"
fi

# Check deployment script
if [ -f "./scripts/deploy-mcp-optimizer.sh" ] && [ -x "./scripts/deploy-mcp-optimizer.sh" ]; then
    test_result 0 "MCP deployment script exists and is executable"
else
    test_result 1 "MCP deployment script missing or not executable"
fi

echo ""
echo "📋 Test 3: Database Schema Validation"
echo "------------------------------------"

# Check database schema
if [ -f "./schema/ap2-agent-db.sql" ]; then
    # Check if settings table is defined
    if grep -q "CREATE TABLE.*settings" "./schema/ap2-agent-db.sql"; then
        test_result 0 "Settings table defined in schema"
    else
        test_result 1 "Settings table missing from schema"
    fi
    
    # Check if kill_switch setting is seeded
    if grep -q "kill_switch" "./schema/ap2-agent-db.sql"; then
        test_result 0 "Kill switch setting seeded in schema"
    else
        test_result 1 "Kill switch setting missing from schema"
    fi
    
    # Check if daily spend limit is seeded
    if grep -q "max_daily_spend_usd" "./schema/ap2-agent-db.sql"; then
        test_result 0 "Daily spend limit setting seeded"
    else
        test_result 1 "Daily spend limit setting missing"
    fi
else
    test_result 1 "Database schema file missing"
fi

echo ""
echo "📋 Test 4: Worker Code Validation"
echo "--------------------------------"

if [ -f "./src/optimizer-worker.js" ]; then
    # Check for kill switch implementation
    if grep -q "kill_switch" "./src/optimizer-worker.js"; then
        test_result 0 "Kill switch implemented in worker"
    else
        test_result 1 "Kill switch missing from worker"
    fi
    
    # Check for /status endpoint
    if grep -q "/status" "./src/optimizer-worker.js"; then
        test_result 0 "Status endpoint implemented"
    else
        test_result 1 "Status endpoint missing"
    fi
    
    # Check for Circle webhook handler
    if grep -q "/webhook/circle" "./src/optimizer-worker.js"; then
        test_result 0 "Circle webhook handler implemented"
    else
        test_result 1 "Circle webhook handler missing"
    fi
    
    # Check for spend guard
    if grep -q "withinDailySpend" "./src/optimizer-worker.js"; then
        test_result 0 "Daily spend guard implemented"
    else
        test_result 1 "Daily spend guard missing"
    fi
    
    # Check for KV caching
    if grep -q "API_KEY_KV" "./src/optimizer-worker.js"; then
        test_result 0 "KV caching implemented"
    else
        test_result 1 "KV caching missing"
    fi
    
    # Check for performance logging
    if grep -q "logPerformanceMetric" "./src/optimizer-worker.js"; then
        test_result 0 "Performance logging implemented"
    else
        test_result 1 "Performance logging missing"
    fi
fi

echo ""
echo "📋 Test 5: System Dependencies"
echo "-----------------------------"

# Check Node.js
if command -v node >/dev/null 2>&1; then
    NODE_VERSION=$(node --version)
    test_result 0 "Node.js available: $NODE_VERSION"
else
    test_result 1 "Node.js not available"
fi

# Check npm
if command -v npm >/dev/null 2>&1; then
    NPM_VERSION=$(npm --version)
    test_result 0 "npm available: $NPM_VERSION"
else
    test_result 1 "npm not available"
fi

# Check Wrangler
if command -v wrangler >/dev/null 2>&1; then
    WRANGLER_VERSION=$(wrangler --version)
    test_result 0 "Wrangler CLI available: $WRANGLER_VERSION"
else
    test_result 1 "Wrangler CLI not available"
fi

# Check curl
if command -v curl >/dev/null 2>&1; then
    test_result 0 "curl available for testing"
else
    test_result 1 "curl not available"
fi

echo ""
echo "📋 Test 6: Network Performance"
echo "-----------------------------"

# Test basic connectivity
if curl -s --max-time 5 https://1.1.1.1 >/dev/null 2>&1; then
    test_result 0 "Basic network connectivity working"
else
    test_result 1 "Network connectivity issues"
fi

# Test Cloudflare connectivity
if curl -s --max-time 5 https://workers.dev >/dev/null 2>&1; then
    test_result 0 "Cloudflare Workers connectivity working"
else
    test_result 1 "Cloudflare Workers connectivity issues"
fi

# Test response time
RESPONSE_TIME=$(curl -s -w "%{time_total}" -o /dev/null https://workers.dev 2>/dev/null || echo "999")
if [ "$(echo "$RESPONSE_TIME < 2.0" | bc 2>/dev/null || echo "0")" = "1" ]; then
    test_result 0 "Network response time: ${RESPONSE_TIME}s (Good)"
else
    test_result 1 "Network response time: ${RESPONSE_TIME}s (Slow)"
fi

echo ""
echo "🎯 OPTIMIZATION READINESS SUMMARY"
echo "================================"

TOTAL_TESTS=$((TESTS_PASSED + TESTS_FAILED))
PASS_RATE=$((TESTS_PASSED * 100 / TOTAL_TESTS))

echo "📊 Test Results:"
echo "• Total Tests: $TOTAL_TESTS"
echo "• Passed: $TESTS_PASSED"
echo "• Failed: $TESTS_FAILED"
echo "• Pass Rate: $PASS_RATE%"
echo ""

if [ $PASS_RATE -ge 90 ]; then
    echo -e "${GREEN}✅ EXCELLENT! System is ready for MCP optimization deployment${NC}"
    echo "   Run: ./scripts/deploy-mcp-optimizer.sh"
elif [ $PASS_RATE -ge 75 ]; then
    echo -e "${YELLOW}⚠️  GOOD! Minor issues detected, but deployment should work${NC}"
    echo "   Fix failed tests and run: ./scripts/deploy-mcp-optimizer.sh"
else
    echo -e "${RED}❌ ISSUES DETECTED! Fix failed tests before deployment${NC}"
    echo "   Address the failed tests and run this validation again"
fi

echo ""
echo "🚀 NEXT STEPS:"
echo "1. Fix any failed tests above"
echo "2. Run environment optimization: ./scripts/optimize-mcp-env.sh"
echo "3. Deploy optimized system: ./scripts/deploy-mcp-optimizer.sh"
echo "4. Monitor performance: ./monitor-mcp-system.sh <worker-url>"

exit $TESTS_FAILED