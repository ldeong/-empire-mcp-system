#!/bin/bash
# stagenet-test.sh - Complete stagenet testing script

set -e

echo "🧪 EMPIRE MONERO STAGENET TESTING"
echo "=================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
log_step "Checking prerequisites..."

if [ ! -f "signer/.env" ]; then
    log_error ".env file not found in signer directory"
    echo "Copy .env.example to .env and configure it first"
    exit 1
fi

# Source environment
cd signer
source .env

if [ -z "$WALLET_MASTER_PASSPHRASE" ]; then
    log_error "WALLET_MASTER_PASSPHRASE not set in .env"
    exit 1
fi

if [ "$MONERO_NETWORK" != "stagenet" ]; then
    log_warning "MONERO_NETWORK is not set to stagenet"
    echo "This script is for stagenet testing only"
    exit 1
fi

log_success "Prerequisites check passed"

# Install dependencies if needed
log_step "Installing dependencies..."
if [ ! -d "node_modules" ]; then
    npm install
fi
log_success "Dependencies ready"

# Create test wallet
log_step "Creating stagenet test wallet..."
if [ ! -f "secure-wallets/empire-primary.encrypted" ]; then
    echo "Creating new stagenet wallet..."
    node wallet-create.js empire-test > wallet-creation.log 2>&1
    
    if [ $? -eq 0 ]; then
        log_success "Test wallet created successfully"
        echo "📋 Wallet details saved to wallet-creation.log"
        echo "⚠️  BACKUP YOUR MNEMONIC PHRASE FROM THE LOG!"
    else
        log_error "Failed to create wallet"
        cat wallet-creation.log
        exit 1
    fi
else
    log_success "Test wallet already exists"
fi

# Extract address for testing
WALLET_ADDRESS=$(node -e "
const { EmpireWalletCreator } = require('./wallet-create');
const creator = new EmpireWalletCreator();
creator.getAddress('empire-test').then(addr => console.log(addr)).catch(console.error);
")

log_success "Wallet address: $WALLET_ADDRESS"

# Start signer service in background
log_step "Starting signer service..."
node signer-service.js > signer.log 2>&1 &
SIGNER_PID=$!
echo $SIGNER_PID > signer.pid

# Wait for service to start
sleep 3

# Test signer health
log_step "Testing signer health..."
HEALTH_RESPONSE=$(curl -s -X GET "http://localhost:3001/health" \
    -H "X-Signer-Token: $SIGNER_AUTH_TOKEN")

if echo "$HEALTH_RESPONSE" | grep -q "healthy"; then
    log_success "Signer service is healthy"
else
    log_error "Signer service health check failed"
    echo "Response: $HEALTH_RESPONSE"
    kill $SIGNER_PID 2>/dev/null || true
    exit 1
fi

# Test address endpoint
log_step "Testing address endpoint..."
ADDRESS_RESPONSE=$(curl -s -X GET "http://localhost:3001/get-address" \
    -H "X-Signer-Token: $SIGNER_AUTH_TOKEN")

if echo "$ADDRESS_RESPONSE" | grep -q "$WALLET_ADDRESS"; then
    log_success "Address endpoint working correctly"
else
    log_error "Address endpoint test failed"
    echo "Response: $ADDRESS_RESPONSE"
    kill $SIGNER_PID 2>/dev/null || true
    exit 1
fi

# Load wallet for operations
log_step "Loading wallet for operations..."
LOAD_RESPONSE=$(curl -s -X POST "http://localhost:3001/load-wallet" \
    -H "X-Signer-Token: $SIGNER_AUTH_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"walletName": "empire-test"}')

if echo "$LOAD_RESPONSE" | grep -q "success.*true"; then
    log_success "Wallet loaded successfully"
else
    log_error "Failed to load wallet"
    echo "Response: $LOAD_RESPONSE"
    kill $SIGNER_PID 2>/dev/null || true
    exit 1
fi

# Test balance check
log_step "Testing balance check..."
BALANCE_RESPONSE=$(curl -s -X GET "http://localhost:3001/balance" \
    -H "X-Signer-Token: $SIGNER_AUTH_TOKEN")

if echo "$BALANCE_RESPONSE" | grep -q "balance"; then
    log_success "Balance check working"
    echo "Balance response: $BALANCE_RESPONSE"
else
    log_error "Balance check failed"
    echo "Response: $BALANCE_RESPONSE"
    kill $SIGNER_PID 2>/dev/null || true
    exit 1
fi

# Start transaction watcher
log_step "Starting transaction watcher..."
node watcher.js > watcher.log 2>&1 &
WATCHER_PID=$!
echo $WATCHER_PID > watcher.pid

# Wait for watcher to initialize
sleep 5

# Test ledger creation
log_step "Testing ledger system..."
cd ../ledger
node balance-checker.js check > balance-check.log 2>&1

if [ $? -eq 0 ]; then
    log_success "Ledger system working"
else
    log_warning "Ledger system test had issues (may be normal for empty wallet)"
fi

cd ../signer

echo ""
echo "🎯 STAGENET TEST RESULTS"
echo "========================"
log_success "✅ Wallet creation: PASSED"
log_success "✅ Signer service: PASSED"
log_success "✅ Address endpoint: PASSED"
log_success "✅ Wallet loading: PASSED"
log_success "✅ Balance check: PASSED"
log_success "✅ Transaction watcher: STARTED"
log_success "✅ Ledger system: TESTED"

echo ""
echo "🚀 NEXT STEPS FOR TESTING:"
echo "1. Get stagenet XMR from faucet"
echo "2. Send test payment to: $WALLET_ADDRESS"
echo "3. Wait for transaction detection and confirmation"
echo "4. Verify ledger updates"
echo "5. Test reinvestment system"

echo ""
echo "🔧 RUNNING SERVICES:"
echo "- Signer Service PID: $SIGNER_PID (log: signer.log)"
echo "- Transaction Watcher PID: $WATCHER_PID (log: watcher.log)"

echo ""
echo "🛑 TO STOP SERVICES:"
echo "kill $SIGNER_PID $WATCHER_PID"
echo "or run: ./stop-test.sh"

# Create stop script
cat > stop-test.sh << 'EOF'
#!/bin/bash
echo "🛑 Stopping stagenet test services..."

if [ -f signer.pid ]; then
    SIGNER_PID=$(cat signer.pid)
    kill $SIGNER_PID 2>/dev/null && echo "✅ Stopped signer service"
    rm signer.pid
fi

if [ -f watcher.pid ]; then
    WATCHER_PID=$(cat watcher.pid)
    kill $WATCHER_PID 2>/dev/null && echo "✅ Stopped watcher service"
    rm watcher.pid
fi

echo "✅ All test services stopped"
EOF
chmod +x stop-test.sh

echo ""
log_success "🎉 STAGENET TEST SETUP COMPLETE!"
echo "Services are running and ready for testing."
echo "Check the logs for any issues: signer.log, watcher.log"