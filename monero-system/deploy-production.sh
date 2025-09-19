#!/bin/bash
# deploy-production.sh - Production deployment script

set -e

echo "🚀 EMPIRE MONERO PRODUCTION DEPLOYMENT"
echo "======================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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

# Safety checks
log_step "🔒 PRODUCTION SAFETY CHECKS"

if [ ! -f "signer/.env" ]; then
    log_error "Environment file not found"
    exit 1
fi

cd signer
source .env

if [ "$MONERO_NETWORK" != "mainnet" ]; then
    log_error "MONERO_NETWORK must be 'mainnet' for production"
    exit 1
fi

if [ -z "$WALLET_MASTER_PASSPHRASE" ]; then
    log_error "WALLET_MASTER_PASSPHRASE not set"
    exit 1
fi

if [ ${#WALLET_MASTER_PASSPHRASE} -lt 32 ]; then
    log_error "WALLET_MASTER_PASSPHRASE too short (minimum 32 characters)"
    exit 1
fi

log_success "Environment checks passed"

# Confirm production deployment
echo ""
log_warning "⚠️  PRODUCTION DEPLOYMENT WARNING"
echo "This will deploy to MAINNET with REAL MONEY"
echo "Ensure you have:"
echo "1. ✅ Tested thoroughly on stagenet"
echo "2. ✅ Secured your environment variables"
echo "3. ✅ Backed up wallet recovery phrases"
echo "4. ✅ Configured firewall and security"
echo "5. ✅ Set up monitoring and alerts"
echo ""

read -p "Continue with production deployment? (yes/NO): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
    echo "Deployment cancelled"
    exit 0
fi

log_step "Creating production mainnet wallet..."

# Create production wallet
if [ ! -f "secure-wallets/empire-primary.encrypted" ]; then
    echo "Creating new mainnet wallet..."
    node wallet-create.js empire-primary > production-wallet.log 2>&1
    
    if [ $? -eq 0 ]; then
        log_success "Production wallet created"
        echo "🔐 CRITICAL: Backup production-wallet.log securely and offline!"
        echo "🔐 Store the mnemonic phrase in multiple secure locations"
    else
        log_error "Failed to create production wallet"
        cat production-wallet.log
        exit 1
    fi
else
    log_success "Production wallet already exists"
fi

# Deploy Cloudflare Worker
log_step "Deploying Cloudflare Worker..."
cd ../worker

# Configure production secrets
echo "Setting up production secrets..."
wrangler secret put SIGNER_AUTH_TOKEN --name empire-monero-worker
wrangler secret put SIGNER_URL --name empire-monero-worker

# Deploy worker
wrangler deploy --name empire-monero-worker

if [ $? -eq 0 ]; then
    log_success "Cloudflare Worker deployed"
else
    log_error "Worker deployment failed"
    exit 1
fi

cd ../signer

# Create production systemd services
log_step "Creating systemd services..."

sudo tee /etc/systemd/system/empire-signer.service > /dev/null << EOF
[Unit]
Description=Empire Monero Signer Service
After=network.target

[Service]
Type=simple
User=empire
WorkingDirectory=$(pwd)
Environment=NODE_ENV=production
ExecStart=/usr/bin/node signer-service.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=empire-signer

# Security settings
NoNewPrivileges=yes
PrivateTmp=yes
ProtectSystem=strict
ProtectHome=yes
ReadWritePaths=$(pwd)

[Install]
WantedBy=multi-user.target
EOF

sudo tee /etc/systemd/system/empire-watcher.service > /dev/null << EOF
[Unit]
Description=Empire Monero Transaction Watcher
After=network.target

[Service]
Type=simple
User=empire
WorkingDirectory=$(pwd)
Environment=NODE_ENV=production
ExecStart=/usr/bin/node watcher.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=empire-watcher

# Security settings
NoNewPrivileges=yes
PrivateTmp=yes
ProtectSystem=strict
ProtectHome=yes
ReadWritePaths=$(pwd)

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd and start services
sudo systemctl daemon-reload
sudo systemctl enable empire-signer
sudo systemctl enable empire-watcher

log_success "Systemd services created"

# Set up monitoring
log_step "Setting up monitoring..."

# Create monitoring script
cat > monitor-system.sh << 'EOF'
#!/bin/bash
# System monitoring script

echo "📊 EMPIRE MONERO SYSTEM STATUS"
echo "============================="

echo ""
echo "🔧 SERVICES:"
systemctl is-active empire-signer && echo "✅ Signer: Running" || echo "❌ Signer: Stopped"
systemctl is-active empire-watcher && echo "✅ Watcher: Running" || echo "❌ Watcher: Stopped"

echo ""
echo "💰 BALANCE:"
curl -s -X GET "http://localhost:3001/balance" -H "X-Signer-Token: $SIGNER_AUTH_TOKEN" | jq .

echo ""
echo "📊 RECENT ACTIVITY:"
cd ../ledger && node balance-checker.js report

echo ""
echo "🔍 SYSTEM HEALTH:"
curl -s -X GET "http://localhost:3001/health" -H "X-Signer-Token: $SIGNER_AUTH_TOKEN" | jq .
EOF

chmod +x monitor-system.sh

# Set up log rotation
sudo tee /etc/logrotate.d/empire-monero > /dev/null << EOF
/var/log/empire/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 0644 empire empire
    postrotate
        systemctl reload empire-signer empire-watcher
    endscript
}
EOF

log_success "Monitoring setup complete"

# Configure firewall
log_step "Configuring firewall..."

# Allow only necessary ports
sudo ufw --force enable
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow SSH (be careful!)
sudo ufw allow ssh

# Allow signer service only from specific IPs
IFS=',' read -ra ADDR_ARRAY <<< "$ALLOWED_IPS"
for ip in "${ADDR_ARRAY[@]}"; do
    sudo ufw allow from $ip to any port 3001
    echo "Allowed signer access from: $ip"
done

log_success "Firewall configured"

# Start services
log_step "Starting production services..."

sudo systemctl start empire-signer
sudo systemctl start empire-watcher

# Wait for services to start
sleep 5

# Verify services
if systemctl is-active --quiet empire-signer && systemctl is-active --quiet empire-watcher; then
    log_success "Production services started successfully"
else
    log_error "Service startup failed"
    echo "Check logs with: journalctl -u empire-signer -f"
    exit 1
fi

# Final verification
log_step "Final system verification..."

HEALTH_CHECK=$(curl -s -X GET "http://localhost:3001/health" -H "X-Signer-Token: $SIGNER_AUTH_TOKEN")
if echo "$HEALTH_CHECK" | grep -q "healthy"; then
    log_success "System health check passed"
else
    log_error "System health check failed"
    echo "Response: $HEALTH_CHECK"
    exit 1
fi

echo ""
echo "🎉 PRODUCTION DEPLOYMENT COMPLETE!"
echo "=================================="
log_success "✅ Mainnet wallet created and secured"
log_success "✅ Cloudflare Worker deployed"
log_success "✅ Systemd services configured"
log_success "✅ Monitoring and logging setup"
log_success "✅ Firewall configured"
log_success "✅ Production services running"

echo ""
echo "🔧 MANAGEMENT COMMANDS:"
echo "Monitor system: ./monitor-system.sh"
echo "Check logs: journalctl -u empire-signer -f"
echo "Restart services: sudo systemctl restart empire-signer empire-watcher"
echo "Stop services: sudo systemctl stop empire-signer empire-watcher"

echo ""
echo "⚠️  CRITICAL REMINDERS:"
echo "1. 🔐 Secure your wallet recovery phrases offline"
echo "2. 📊 Monitor system regularly with ./monitor-system.sh"
echo "3. 💾 Backup encrypted wallet files regularly"
echo "4. 🔍 Check logs for any suspicious activity"
echo "5. 🔒 Keep environment variables secure"

echo ""
log_success "💰 READY FOR REAL INCOME GENERATION!"

cd ..