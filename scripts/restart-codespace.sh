#!/usr/bin/env bash
# Robust Codespaces Restart Helper for MCP
# Usage: ./scripts/restart-codespace.sh
# - Stops running MCP server
# - Restarts Codespace (if gh available and authenticated)
# - Reinstalls dependencies
# - Starts MCP via scripts/mcp-control.js (preferred)
# - Performs health checks and logs to restart-codespace.log

set -euo pipefail

LOG_FILE="restart-codespace.log"
: > "$LOG_FILE"

log() {
  echo "[$(date -u +'%Y-%m-%dT%H:%M:%SZ')] $*" | tee -a "$LOG_FILE"
}

fail() {
  log "ERROR: $*"
  exit 1
}

log "===== MCP Restart Script Initiated ====="

# 1) Attempt graceful stop via mcp-control.js if available
if command -v node >/dev/null 2>&1 && [ -f "scripts/mcp-control.js" ]; then
  log "Attempting graceful stop via scripts/mcp-control.js..."
  if node scripts/mcp-control.js stop &>>"$LOG_FILE"; then
    log "mcp-control stop requested."
  else
    log "mcp-control stop returned non-zero; proceeding to pkill fallback."
  fi
fi

# Fallback: kill likely processes
log "Stopping node/npm processes (fallback)..."
pkill -f "node server.js" 2>/dev/null || true
pkill -f "npm start" 2>/dev/null || true
sleep 2

# 2) Restart Codespace via gh if available
if command -v gh >/dev/null 2>&1; then
  if [ -n "${CODESPACE_NAME:-}" ]; then
    NAME="$CODESPACE_NAME"
  else
    NAME=$(gh codespace list --json name,state -q '.[] | select(.state=="Available") | .name' | head -n 1 || true)
  fi

  if [ -z "$NAME" ]; then
    log "No available Codespace name found via gh. Skipping remote restart (may be running inside Codespace)."
  else
    log "Stopping Codespace: $NAME"
    if gh codespace stop -c "$NAME" &>>"$LOG_FILE"; then
      log "Codespace stopped: $NAME"
    else
      log "Failed to stop Codespace $NAME; continuing."
    fi
    sleep 5
    log "Starting Codespace: $NAME"
    if gh codespace start -c "$NAME" &>>"$LOG_FILE"; then
      log "Codespace started: $NAME"
    else
      log "Failed to start Codespace $NAME; continuing."
    fi
    log "Waiting 20 seconds for Codespace to initialize..."
    sleep 20
  fi
else
  log "gh CLI not found. Skipping Codespace restart step."
fi

# 3) Reinstall dependencies (safe for local dev)
if command -v npm >/dev/null 2>&1; then
  log "Running npm install..."
  if npm install &>>"$LOG_FILE"; then
    log "npm install completed."
  else
    fail "npm install failed. Check $LOG_FILE for details."
  fi
else
  fail "npm not found. Please install Node.js/npm."
fi

# 4) Start MCP (preferred: mcp-control.js)
log "Starting MCP server..."
if [ -f "scripts/mcp-control.js" ]; then
  if node scripts/mcp-control.js start &>>"$LOG_FILE" & then
    log "mcp-control start invoked."
  else
    fail "mcp-control start failed to launch. Check $LOG_FILE."
  fi
else
  if npm start &>>"$LOG_FILE" & then
    log "npm start launched in background."
  else
    fail "npm start failed to launch. Check $LOG_FILE."
  fi
fi

# 5) Health check loop
HEALTH_URL="http://localhost:3000/health"
ATTEMPTS=12
SLEEP_SECONDS=5
log "Performing health checks against $HEALTH_URL ($ATTEMPTS attempts, ${SLEEP_SECONDS}s interval)..."
i=1
while [ $i -le $ATTEMPTS ]; do
  if curl -sf "$HEALTH_URL" -m 3 >/dev/null 2>&1; then
    log "✅ Health check passed on attempt $i."
    log "===== MCP Restart Script Completed SUCCESS ====="
    exit 0
  else
    log "⚠️ Health check failed on attempt $i. Waiting ${SLEEP_SECONDS}s before retry..."
    sleep "$SLEEP_SECONDS"
  fi
  i=$((i+1))
done

log "❌ Health check failed after $ATTEMPTS attempts. See $LOG_FILE for server logs."
log "You can inspect logs: tail -n 200 $LOG_FILE"
exit 2