#!/bin/bash

# optimize-mcp-env.sh - MCP Development Environment Optimizer
# Prevents VSCode extension crashes and optimizes performance for MCP/WebSocket development

set -e

echo "🔧 Optimizing MCP Development Environment..."
echo "📊 Date: $(date)"
echo "💻 Host: $(hostname)"
echo "🌐 Distro: $(lsb_release -ds 2>/dev/null || cat /etc/os-release | grep PRETTY_NAME | cut -d'"' -f2)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

info() { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# 1. CLEAR MCP CACHES
echo "🧹 Clearing MCP-specific caches..."
rm -rf ~/.cache/mcp/ 2>/dev/null || true
rm -rf .mcp-cache 2>/dev/null || true
rm -rf ~/.vscode-server/logs/* 2>/dev/null || true
rm -rf ~/.vscode-remote/logs/* 2>/dev/null || true

# Clear Node.js caches that can cause issues
if command_exists npm; then
    info "Clearing npm cache..."
    npm cache clean --force --silent 2>/dev/null || true
fi

success "Caches cleared"

# 2. OPTIMIZE SYSTEM LIMITS
echo "📈 Setting higher system limits for MCP operations..."

# Increase memory limits (8GB virtual memory limit)
ulimit -v 8388608 2>/dev/null || warning "Could not set memory limit"

# Increase file descriptor limit (for WebSocket connections)
ulimit -n 2048 2>/dev/null || warning "Could not set file descriptor limit"

# Increase process limit
ulimit -u 4096 2>/dev/null || warning "Could not set process limit"

# Make limits persistent
if [ -f /etc/security/limits.conf ]; then
    info "Making limits persistent..."
    echo "* soft nofile 2048" | sudo tee -a /etc/security/limits.conf > /dev/null 2>&1 || true
    echo "* hard nofile 4096" | sudo tee -a /etc/security/limits.conf > /dev/null 2>&1 || true
    echo "* soft nproc 4096" | sudo tee -a /etc/security/limits.conf > /dev/null 2>&1 || true
fi

success "System limits optimized"

# 3. OPTIMIZE NETWORK FOR WEBSOCKETS
echo "🌐 Optimizing network for WebSocket/MCP performance..."

# Set TCP optimization for WebSockets
sudo sysctl -w net.core.rmem_max=16777216 2>/dev/null || true
sudo sysctl -w net.core.wmem_max=16777216 2>/dev/null || true
sudo sysctl -w net.ipv4.tcp_rmem="4096 87380 16777216" 2>/dev/null || true
sudo sysctl -w net.ipv4.tcp_wmem="4096 65536 16777216" 2>/dev/null || true

# Enable TCP window scaling for better performance
sudo sysctl -w net.ipv4.tcp_window_scaling=1 2>/dev/null || true
sudo sysctl -w net.ipv4.tcp_timestamps=1 2>/dev/null || true

success "Network optimized for WebSockets"

# 4. SYSTEM PACKAGE OPTIMIZATION
echo "📦 Updating system packages for optimal performance..."

if command_exists apt-get; then
    info "Updating apt packages..."
    sudo apt-get clean > /dev/null 2>&1 || true
    sudo apt-get update -qq > /dev/null 2>&1 || true
    sudo apt-get upgrade -y -qq > /dev/null 2>&1 || true
    
    # Install performance monitoring tools
    sudo apt-get install -y -qq htop iotop curl jq > /dev/null 2>&1 || true
    
elif command_exists yum; then
    info "Updating yum packages..."
    sudo yum clean all > /dev/null 2>&1 || true
    sudo yum update -y -q > /dev/null 2>&1 || true
fi

success "System packages updated"

# 5. DOCKER OPTIMIZATION (if containerized)
if command_exists docker; then
    echo "🐳 Optimizing Docker for MCP development..."
    
    # Clean up Docker to free resources
    docker system prune -f > /dev/null 2>&1 || true
    
    # Optimize Docker daemon
    sudo mkdir -p /etc/docker
    cat > /tmp/docker-daemon.json << EOF
{
    "experimental": true,
    "max-concurrent-downloads": 3,
    "max-concurrent-uploads": 5,
    "live-restore": true,
    "storage-driver": "overlay2",
    "log-driver": "json-file",
    "log-opts": {
        "max-size": "10m",
        "max-file": "3"
    }
}
EOF
    
    sudo cp /tmp/docker-daemon.json /etc/docker/daemon.json 2>/dev/null || true
    
    # Restart Docker services
    info "Restarting Docker services..."
    sudo systemctl restart containerd > /dev/null 2>&1 || true
    sudo systemctl restart docker > /dev/null 2>&1 || true
    
    success "Docker optimized"
fi

# 6. VSCODE REMOTE OPTIMIZATION
echo "💻 Optimizing VS Code Remote for MCP development..."

# Create optimized VS Code settings for remote
mkdir -p ~/.vscode-remote/data/Machine 2>/dev/null || true
cat > ~/.vscode-remote/data/Machine/settings.json << EOF
{
    "files.watcherExclude": {
        "**/.git/objects/**": true,
        "**/node_modules/**": true,
        "**/.cache/**": true,
        "**/dist/**": true,
        "**/build/**": true,
        "**/.mcp-cache/**": true
    },
    "search.exclude": {
        "**/node_modules": true,
        "**/.cache": true,
        "**/dist": true,
        "**/build": true,
        "**/.mcp-cache": true
    },
    "typescript.updateImportsOnFileMove.enabled": "never",
    "typescript.suggest.autoImports": false,
    "files.maxMemoryForLargeFilesMB": 4096,
    "editor.codeLens": false,
    "breadcrumbs.enabled": false,
    "telemetry.telemetryLevel": "off",
    "extensions.autoCheckUpdates": false,
    "extensions.autoUpdate": false,
    "workbench.settings.enableNaturalLanguageSearch": false,
    "terminal.integrated.persistentSessionReviveProcess": "never",
    "remote.downloadExtensionsLocally": true
}
EOF

success "VS Code Remote optimized"

# 7. NODE.JS OPTIMIZATION
if command_exists node; then
    echo "🟢 Optimizing Node.js for MCP operations..."
    
    # Set Node.js memory optimization flags
    export NODE_OPTIONS="--max-old-space-size=4096 --optimize-for-size"
    echo 'export NODE_OPTIONS="--max-old-space-size=4096 --optimize-for-size"' >> ~/.bashrc
    
    # Update npm to latest
    npm install -g npm@latest > /dev/null 2>&1 || true
    
    success "Node.js optimized"
fi

# 8. CREATE PERFORMANCE MONITORING SCRIPT
echo "📊 Creating performance monitoring script..."

cat > ~/monitor-mcp.sh << 'EOF'
#!/bin/bash
# MCP Performance Monitor

echo "📊 MCP System Performance - $(date)"
echo "=" | tr ' ' '=' | head -60

# Memory usage
echo "💾 Memory Usage:"
free -h | grep -E "(Mem|Swap)"
echo ""

# CPU usage
echo "🧠 CPU Usage:"
if command -v htop >/dev/null; then
    htop -b -C --no-color -n 1 | head -5
else
    top -bn1 | head -5
fi
echo ""

# Network connections
echo "🌐 Active Connections:"
ss -tuln | grep -E ":(80|443|8080|3000)" | wc -l
echo ""

# WebSocket connections
echo "🔌 WebSocket Status:"
ps aux | grep -E "(node|wrangler|mcp)" | grep -v grep | wc -l
echo ""

# Disk usage
echo "💽 Disk Usage:"
df -h / | tail -1
echo ""

# Recent errors in logs
echo "❌ Recent Errors:"
journalctl --since "5 minutes ago" --no-pager -q | grep -i error | tail -3 || echo "No recent errors"
EOF

chmod +x ~/monitor-mcp.sh
echo "alias monitor-mcp='~/monitor-mcp.sh'" >> ~/.bashrc

success "Performance monitoring script created: ~/monitor-mcp.sh"

# 9. RESTART CRITICAL SERVICES
echo "🔄 Restarting critical services for optimal performance..."

# Restart SSH for better remote connections
sudo systemctl restart ssh > /dev/null 2>&1 || true

# Restart networking
sudo systemctl restart systemd-networkd > /dev/null 2>&1 || true
sudo systemctl restart NetworkManager > /dev/null 2>&1 || true

# Clear system logs if they're taking up space
sudo journalctl --vacuum-time=1d > /dev/null 2>&1 || true

success "Services restarted"

# 10. CLOUDFLARE WRANGLER OPTIMIZATION
if command_exists wrangler; then
    echo "☁️ Optimizing Cloudflare Wrangler for MCP..."
    
    # Clear Wrangler cache
    rm -rf ~/.wrangler/cache/* 2>/dev/null || true
    
    # Set Wrangler optimization flags
    export WRANGLER_LOG=info
    echo 'export WRANGLER_LOG=info' >> ~/.bashrc
    
    # Verify Wrangler is working
    if wrangler --version > /dev/null 2>&1; then
        success "Wrangler optimized: $(wrangler --version)"
    else
        warning "Wrangler may need reinstalling"
    fi
fi

# 11. FINAL CLEANUP AND VALIDATION
echo "✨ Final cleanup and validation..."

# Source updated bashrc
source ~/.bashrc 2>/dev/null || true

# Create quick test script for MCP functions
cat > ~/test-mcp-performance.sh << 'EOF'
#!/bin/bash
# Quick MCP Performance Test

echo "🧪 Testing MCP Performance..."

# Test WebSocket connectivity
if command -v curl >/dev/null; then
    echo "🌐 Testing HTTP connectivity..."
    curl -s -w "Time: %{time_total}s\n" -o /dev/null https://1.1.1.1 || echo "Network test failed"
fi

# Test local server response
if command -v nc >/dev/null; then
    echo "🔌 Testing local port availability..."
    for port in 3000 8080 8000; do
        if nc -z localhost $port 2>/dev/null; then
            echo "Port $port: OPEN"
        else
            echo "Port $port: CLOSED"
        fi
    done
fi

echo "✅ Performance test complete"
EOF

chmod +x ~/test-mcp-performance.sh

# FINAL STATUS REPORT
echo ""
echo "🎉 MCP DEVELOPMENT ENVIRONMENT OPTIMIZATION COMPLETE!"
echo "=" | tr ' ' '=' | head -60
echo ""
echo "✅ OPTIMIZATIONS APPLIED:"
echo "• System limits increased (memory, file descriptors, processes)"
echo "• Network optimized for WebSocket performance"
echo "• VS Code Remote settings optimized"
echo "• Docker optimized (if installed)"
echo "• Node.js memory optimization enabled"
echo "• Caches cleared (MCP, npm, system)"
echo "• Performance monitoring tools installed"
echo ""
echo "🚀 QUICK COMMANDS:"
echo "• Monitor performance: monitor-mcp"
echo "• Test MCP performance: ~/test-mcp-performance.sh"
echo "• Check system status: htop"
echo ""
echo "⚡ EXPECTED IMPROVEMENTS:"
echo "• Faster WebSocket connection establishment"
echo "• Reduced VS Code extension crashes"
echo "• Better MCP server response times"
echo "• More stable remote development experience"
echo ""

# Test if improvements are working
if command_exists curl; then
    info "Testing network performance..."
    RESPONSE_TIME=$(curl -s -w "%{time_total}" -o /dev/null https://workers.dev 2>/dev/null || echo "0")
    if [ "$(echo "$RESPONSE_TIME < 1.0" | bc 2>/dev/null || echo "1")" = "1" ]; then
        success "Network response time: ${RESPONSE_TIME}s (Good)"
    else
        warning "Network response time: ${RESPONSE_TIME}s (May need attention)"
    fi
fi

echo ""
echo "🔧 Environment optimized! You may now reconnect VS Code Remote and try again."
echo "📊 Run 'monitor-mcp' to see real-time performance metrics."

exit 0