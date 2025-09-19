#!/bin/bash

# Restart Codespace Script
# Comprehensive restart script for GitHub Codespaces environment
# Includes MCP server management, dependency installation, and health checks

set -euo pipefail

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_FILE="${PROJECT_ROOT}/restart-codespace.log"
HEALTH_URL="http://localhost:3000/health"
MAX_HEALTH_ATTEMPTS=10
HEALTH_RETRY_DELAY=3

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Logging function
log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    case "$level" in
        "INFO")
            echo -e "${CYAN}[INFO]${NC} $message"
            ;;
        "SUCCESS")
            echo -e "${GREEN}[SUCCESS]${NC} $message"
            ;;
        "WARNING")
            echo -e "${YELLOW}[WARNING]${NC} $message"
            ;;
        "ERROR")
            echo -e "${RED}[ERROR]${NC} $message"
            ;;
        "DEBUG")
            echo -e "${PURPLE}[DEBUG]${NC} $message"
            ;;
    esac
    
    # Also log to file
    echo "[$timestamp] [$level] $message" >> "$LOG_FILE"
}

# Error handler
error_exit() {
    log "ERROR" "$1"
    log "ERROR" "Restart process failed. Check $LOG_FILE for details."
    exit 1
}

# Check if we're in a Codespace
check_codespace_environment() {
    log "INFO" "Checking Codespace environment..."
    
    if [[ -z "${CODESPACE_NAME:-}" ]]; then
        log "WARNING" "CODESPACE_NAME not set - may not be running in Codespaces"
    else
        log "SUCCESS" "Running in Codespace: $CODESPACE_NAME"
    fi
    
    # Check if gh CLI is available
    if ! command -v gh &> /dev/null; then
        log "WARNING" "GitHub CLI (gh) not found - container restart will be skipped"
        return 1
    else
        log "SUCCESS" "GitHub CLI (gh) is available"
        return 0
    fi
}

# Stop running MCP processes
stop_mcp_processes() {
    log "INFO" "Stopping any running MCP dev server processes..."
    
    # Find and kill Node.js processes running server.js
    local pids=$(pgrep -f "node.*server.js" 2>/dev/null || true)
    
    if [[ -n "$pids" ]]; then
        log "INFO" "Found running MCP processes: $pids"
        
        # Try graceful shutdown first
        for pid in $pids; do
            log "INFO" "Sending SIGTERM to process $pid"
            kill -TERM "$pid" 2>/dev/null || true
        done
        
        # Wait a moment for graceful shutdown
        sleep 3
        
        # Check if processes are still running and force kill if necessary
        local remaining_pids=$(pgrep -f "node.*server.js" 2>/dev/null || true)
        if [[ -n "$remaining_pids" ]]; then
            log "WARNING" "Some processes still running, force killing: $remaining_pids"
            for pid in $remaining_pids; do
                kill -KILL "$pid" 2>/dev/null || true
            done
        fi
        
        log "SUCCESS" "MCP processes stopped"
    else
        log "INFO" "No running MCP processes found"
    fi
    
    # Also stop any npm/node processes that might be related
    pkill -f "npm.*start" 2>/dev/null || true
    pkill -f "nodemon" 2>/dev/null || true
    
    log "SUCCESS" "All related processes stopped"
}

# Restart Codespace container
restart_codespace_container() {
    log "INFO" "Attempting to restart Codespace container..."
    
    if ! check_codespace_environment; then
        log "WARNING" "Skipping container restart - not in proper Codespace environment"
        return 0
    fi
    
    # Try to restart the codespace
    log "INFO" "Executing: gh codespace restart"
    if gh codespace restart 2>&1 | tee -a "$LOG_FILE"; then
        log "SUCCESS" "Codespace restart command executed"
        # Note: This script will likely be terminated here as the container restarts
        return 0
    else
        log "WARNING" "Failed to restart Codespace container, continuing with local restart"
        return 1
    fi
}

# Install dependencies
install_dependencies() {
    log "INFO" "Installing/updating dependencies..."
    
    cd "$PROJECT_ROOT"
    
    # Clean npm cache
    log "INFO" "Cleaning npm cache..."
    npm cache clean --force 2>&1 | tee -a "$LOG_FILE" || true
    
    # Remove node_modules if it exists (for clean install)
    if [[ -d "node_modules" ]]; then
        log "INFO" "Removing existing node_modules for clean install..."
        rm -rf node_modules
    fi
    
    # Install dependencies
    log "INFO" "Running npm install..."
    if npm install 2>&1 | tee -a "$LOG_FILE"; then
        log "SUCCESS" "Dependencies installed successfully"
    else
        error_exit "Failed to install dependencies"
    fi
}

# Start MCP server
start_mcp_server() {
    log "INFO" "Starting MCP server..."
    
    cd "$PROJECT_ROOT"
    
    # Check if mcp-control.js exists and use it
    if [[ -f "scripts/mcp-control.js" ]]; then
        log "INFO" "Using MCP control script to start server..."
        if node scripts/mcp-control.js start 2>&1 | tee -a "$LOG_FILE"; then
            log "SUCCESS" "MCP server started via control script"
        else
            log "WARNING" "MCP control script failed, trying direct start..."
            # Fallback to direct start
            npm start &
            log "INFO" "Started MCP server directly with npm start"
        fi
    else
        log "INFO" "Starting MCP server directly..."
        npm start &
        log "INFO" "Started MCP server with npm start"
    fi
    
    # Give the server time to start
    log "INFO" "Waiting for server to initialize..."
    sleep 5
}

# Health check function
health_check() {
    log "INFO" "Performing health check..."
    
    local attempt=1
    
    while [[ $attempt -le $MAX_HEALTH_ATTEMPTS ]]; do
        log "DEBUG" "Health check attempt $attempt/$MAX_HEALTH_ATTEMPTS"
        
        if curl -f -s -m 10 "$HEALTH_URL" >/dev/null 2>&1; then
            log "SUCCESS" "Health check passed! Server is responding at $HEALTH_URL"
            
            # Get and log health response
            local health_response=$(curl -s "$HEALTH_URL" 2>/dev/null || echo "Unable to get response")
            log "INFO" "Health response: $health_response"
            return 0
        else
            log "WARNING" "Health check failed (attempt $attempt/$MAX_HEALTH_ATTEMPTS)"
            
            if [[ $attempt -lt $MAX_HEALTH_ATTEMPTS ]]; then
                log "INFO" "Waiting ${HEALTH_RETRY_DELAY}s before next attempt..."
                sleep $HEALTH_RETRY_DELAY
            fi
        fi
        
        ((attempt++))
    done
    
    log "ERROR" "Health check failed after $MAX_HEALTH_ATTEMPTS attempts"
    return 1
}

# Verify system status
verify_system() {
    log "INFO" "Verifying system status..."
    
    # Check if Node.js processes are running
    local node_processes=$(pgrep -f "node" | wc -l)
    log "INFO" "Active Node.js processes: $node_processes"
    
    # Check if MCP server process is running
    local mcp_processes=$(pgrep -f "node.*server.js" | wc -l)
    if [[ $mcp_processes -gt 0 ]]; then
        log "SUCCESS" "MCP server process is running"
    else
        log "WARNING" "No MCP server process detected"
    fi
    
    # Check port 3000
    if netstat -tuln 2>/dev/null | grep -q ":3000 "; then
        log "SUCCESS" "Port 3000 is in use (likely by MCP server)"
    else
        log "WARNING" "Port 3000 is not in use"
    fi
    
    # Final health check
    if health_check; then
        log "SUCCESS" "System verification completed successfully"
        return 0
    else
        log "ERROR" "System verification failed"
        return 1
    fi
}

# Cleanup function
cleanup() {
    log "INFO" "Performing cleanup..."
    
    # Clean up temporary files
    find "$PROJECT_ROOT" -name "*.tmp" -delete 2>/dev/null || true
    find "$PROJECT_ROOT" -name ".DS_Store" -delete 2>/dev/null || true
    
    log "SUCCESS" "Cleanup completed"
}

# Display system information
show_system_info() {
    log "INFO" "System Information:"
    log "INFO" "===================="
    log "INFO" "Node.js version: $(node --version 2>/dev/null || echo 'Not found')"
    log "INFO" "npm version: $(npm --version 2>/dev/null || echo 'Not found')"
    log "INFO" "Git version: $(git --version 2>/dev/null || echo 'Not found')"
    log "INFO" "GitHub CLI version: $(gh --version 2>/dev/null | head -1 || echo 'Not found')"
    log "INFO" "Current directory: $(pwd)"
    log "INFO" "Project root: $PROJECT_ROOT"
    log "INFO" "Log file: $LOG_FILE"
    log "INFO" "===================="
}

# Main execution function
main() {
    # Initialize log file
    echo "=== Codespace Restart Script Started at $(date) ===" > "$LOG_FILE"
    
    log "INFO" "🚀 Starting Codespace restart process..."
    show_system_info
    
    # Step 1: Stop existing processes
    stop_mcp_processes
    
    # Step 2: Attempt container restart (this might terminate the script)
    if [[ "${SKIP_CONTAINER_RESTART:-}" != "true" ]]; then
        restart_codespace_container
    else
        log "INFO" "Skipping container restart (SKIP_CONTAINER_RESTART=true)"
    fi
    
    # Step 3: Install dependencies
    install_dependencies
    
    # Step 4: Start MCP server
    start_mcp_server
    
    # Step 5: Verify system
    if verify_system; then
        log "SUCCESS" "🎉 Codespace restart completed successfully!"
        log "INFO" "MCP server should be available at: $HEALTH_URL"
        
        # Run dev-helper if available
        if [[ -f "scripts/dev-helper.js" ]]; then
            log "INFO" "Running development helper for additional verification..."
            node scripts/dev-helper.js health || log "WARNING" "Dev helper health check failed"
        fi
    else
        error_exit "System verification failed after restart"
    fi
    
    # Step 6: Cleanup
    cleanup
    
    log "SUCCESS" "All operations completed successfully!"
    echo "=== Codespace Restart Script Completed at $(date) ===" >> "$LOG_FILE"
}

# Handle script interruption
trap 'log "WARNING" "Script interrupted by user"; exit 1' INT TERM

# Show help if requested
if [[ "${1:-}" == "--help" ]] || [[ "${1:-}" == "-h" ]]; then
    echo "Codespace Restart Script"
    echo "======================="
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  --help, -h              Show this help message"
    echo "  --skip-container        Skip container restart (set SKIP_CONTAINER_RESTART=true)"
    echo ""
    echo "Environment Variables:"
    echo "  SKIP_CONTAINER_RESTART  Set to 'true' to skip container restart"
    echo ""
    echo "This script will:"
    echo "  1. Stop any running MCP dev server processes"
    echo "  2. Restart the Codespace container (if gh CLI available)"
    echo "  3. Reinstall dependencies (npm install)"
    echo "  4. Start MCP server using mcp-control.js or npm start"
    echo "  5. Perform health checks on http://localhost:3000/health"
    echo "  6. Log all operations to restart-codespace.log"
    echo ""
    echo "Logs are written to: $LOG_FILE"
    exit 0
fi

# Handle skip container restart option
if [[ "${1:-}" == "--skip-container" ]]; then
    export SKIP_CONTAINER_RESTART=true
fi

# Execute main function
main

# Exit with success
exit 0