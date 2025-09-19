#!/bin/bash

# Empire MCP System - Codespaces Restart Script
# Restarts the Codespace container and reinitializes the MCP development environment
# Author: SINA Empire

set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
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

# Configuration
MCP_SERVER_PORT=3000
HEALTH_ENDPOINT="http://localhost:${MCP_SERVER_PORT}/health"
MAX_HEALTH_RETRIES=30
HEALTH_RETRY_DELAY=2

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Error handling
cleanup() {
    local exit_code=$?
    if [ $exit_code -ne 0 ]; then
        log_error "Script failed with exit code $exit_code"
        log_info "Check the logs above for more details"
    fi
    exit $exit_code
}
trap cleanup EXIT

# Function to check if GitHub CLI is available
check_gh_cli() {
    if ! command -v gh &> /dev/null; then
        log_error "GitHub CLI (gh) is not installed or not in PATH"
        log_info "Please install GitHub CLI: https://cli.github.com/"
        return 1
    fi
    
    if ! gh auth status &> /dev/null; then
        log_error "GitHub CLI is not authenticated"
        log_info "Run 'gh auth login' to authenticate"
        return 1
    fi
    
    log_success "GitHub CLI is available and authenticated"
    return 0
}

# Function to stop any running MCP dev server
stop_mcp_server() {
    log_info "Stopping any running MCP dev server processes..."
    
    # Find and kill processes on the MCP port
    local pids=$(lsof -ti:${MCP_SERVER_PORT} 2>/dev/null || true)
    if [ -n "$pids" ]; then
        log_info "Found MCP server processes: $pids"
        echo "$pids" | xargs kill -TERM 2>/dev/null || true
        sleep 2
        
        # Force kill if still running
        local remaining_pids=$(lsof -ti:${MCP_SERVER_PORT} 2>/dev/null || true)
        if [ -n "$remaining_pids" ]; then
            log_warning "Force killing remaining processes: $remaining_pids"
            echo "$remaining_pids" | xargs kill -KILL 2>/dev/null || true
        fi
        
        log_success "Stopped MCP server processes"
    else
        log_info "No MCP server processes found on port ${MCP_SERVER_PORT}"
    fi
    
    # Also kill any Node.js processes that might be running our server
    pkill -f "node.*server.js" 2>/dev/null || true
    pkill -f "npm.*start" 2>/dev/null || true
    pkill -f "nodemon.*server.js" 2>/dev/null || true
    
    log_success "MCP server stop process completed"
}

# Function to restart Codespace container
restart_codespace_container() {
    log_info "Attempting to restart Codespace container..."
    
    if ! check_gh_cli; then
        log_warning "Cannot restart Codespace container - GitHub CLI not available"
        log_info "Skipping container restart, continuing with local restart..."
        return 0
    fi
    
    # Get current codespace name
    local codespace_name=""
    if [ -n "${CODESPACE_NAME:-}" ]; then
        codespace_name="$CODESPACE_NAME"
    else
        log_warning "CODESPACE_NAME environment variable not set"
        log_info "Attempting to detect current codespace..."
        
        # Try to get codespace info from GitHub CLI
        local codespaces_output=$(gh codespace list --json name,state 2>/dev/null || echo "[]")
        local running_codespace=$(echo "$codespaces_output" | jq -r '.[] | select(.state == "Available") | .name' | head -1)
        
        if [ -n "$running_codespace" ] && [ "$running_codespace" != "null" ]; then
            codespace_name="$running_codespace"
            log_info "Detected running codespace: $codespace_name"
        else
            log_warning "Could not detect current codespace"
            log_info "Skipping container restart, continuing with local restart..."
            return 0
        fi
    fi
    
    if [ -n "$codespace_name" ]; then
        log_info "Restarting codespace: $codespace_name"
        
        # Stop the codespace
        if gh codespace stop --name "$codespace_name" 2>/dev/null; then
            log_success "Codespace stopped successfully"
            
            # Wait a moment for full shutdown
            sleep 5
            
            # Start the codespace
            if gh codespace start --name "$codespace_name" 2>/dev/null; then
                log_success "Codespace restarted successfully"
                
                # Wait for codespace to be fully ready
                log_info "Waiting for codespace to be fully ready..."
                sleep 10
            else
                log_error "Failed to start codespace"
                return 1
            fi
        else
            log_error "Failed to stop codespace"
            return 1
        fi
    else
        log_warning "No codespace name available for restart"
        return 0
    fi
}

# Function to reinstall dependencies
reinstall_dependencies() {
    log_info "Reinstalling dependencies..."
    
    cd "$PROJECT_ROOT"
    
    # Remove node_modules and package-lock.json if they exist
    if [ -d "node_modules" ]; then
        log_info "Removing existing node_modules..."
        rm -rf node_modules
    fi
    
    if [ -f "package-lock.json" ]; then
        log_info "Removing existing package-lock.json..."
        rm -f package-lock.json
    fi
    
    # Clean npm cache
    log_info "Cleaning npm cache..."
    npm cache clean --force 2>/dev/null || true
    
    # Install dependencies
    log_info "Installing dependencies with npm..."
    if npm install; then
        log_success "Dependencies installed successfully"
    else
        log_error "Failed to install dependencies"
        return 1
    fi
}

# Function to start MCP server
start_mcp_server() {
    log_info "Starting MCP server..."
    
    cd "$PROJECT_ROOT"
    
    # Start server in background
    npm start &> /tmp/mcp-server.log &
    local server_pid=$!
    
    if [ -n "$server_pid" ]; then
        log_info "MCP server started with PID: $server_pid"
        
        # Wait a moment for server to initialize
        sleep 3
        
        log_success "MCP server startup initiated"
        return 0
    else
        log_error "Failed to start MCP server"
        return 1
    fi
}

# Function to perform health check
perform_health_check() {
    log_info "Performing health check on $HEALTH_ENDPOINT..."
    
    local retry_count=0
    while [ $retry_count -lt $MAX_HEALTH_RETRIES ]; do
        if curl -s -f "$HEALTH_ENDPOINT" > /dev/null 2>&1; then
            local health_response=$(curl -s "$HEALTH_ENDPOINT" 2>/dev/null || echo '{"status":"unknown"}')
            log_success "Health check passed!"
            log_info "Health response: $health_response"
            
            # Parse and display health status
            if command -v jq &> /dev/null; then
                local status=$(echo "$health_response" | jq -r '.status // "unknown"')
                local timestamp=$(echo "$health_response" | jq -r '.timestamp // "unknown"')
                log_info "Server status: $status"
                log_info "Timestamp: $timestamp"
            fi
            
            return 0
        else
            retry_count=$((retry_count + 1))
            log_info "Health check attempt $retry_count/$MAX_HEALTH_RETRIES failed, retrying in ${HEALTH_RETRY_DELAY}s..."
            sleep $HEALTH_RETRY_DELAY
        fi
    done
    
    log_error "Health check failed after $MAX_HEALTH_RETRIES attempts"
    log_error "Server may not be running correctly"
    
    # Show server logs for debugging
    if [ -f "/tmp/mcp-server.log" ]; then
        log_info "Recent server logs:"
        tail -10 /tmp/mcp-server.log || true
    fi
    
    return 1
}

# Function to show final status
show_final_status() {
    log_info "=== Codespace Restart Summary ==="
    log_info "Project Root: $PROJECT_ROOT"
    log_info "Server Port: $MCP_SERVER_PORT"
    log_info "Health Endpoint: $HEALTH_ENDPOINT"
    
    # Check if server is still running
    if curl -s -f "$HEALTH_ENDPOINT" > /dev/null 2>&1; then
        log_success "✅ MCP Server is running and healthy"
        log_info "You can access the server at: http://localhost:${MCP_SERVER_PORT}"
        log_info "Health endpoint: $HEALTH_ENDPOINT"
    else
        log_error "❌ MCP Server is not responding"
        log_info "Check the server logs for more information"
    fi
    
    log_info "=== Available Commands ==="
    log_info "• Test server: curl $HEALTH_ENDPOINT"
    log_info "• Run tests: npm test"
    log_info "• View logs: tail -f /tmp/mcp-server.log"
    log_info "• Stop server: pkill -f 'node.*server.js'"
}

# Main execution
main() {
    log_info "🚀 Starting Empire MCP System Codespace Restart"
    log_info "=================================================="
    
    # Step 1: Stop any running MCP server
    stop_mcp_server
    
    # Step 2: Restart Codespace container (if possible)
    restart_codespace_container
    
    # Step 3: Reinstall dependencies
    reinstall_dependencies
    
    # Step 4: Start MCP server
    start_mcp_server
    
    # Step 5: Perform health check
    perform_health_check
    
    # Step 6: Show final status
    show_final_status
    
    log_success "🎉 Codespace restart completed successfully!"
}

# Execute main function
main "$@"