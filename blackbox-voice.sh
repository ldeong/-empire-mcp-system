#!/bin/bash

# 🗣️ Blackbox Voice Agent Integration Script
# Connects Blackbox to the SINA Empire PWA for voice commanding

set -e

echo "🗣️ Setting up Blackbox Voice Integration..."

# 1. Ensure .env is sourced
if [ ! -f .env ]; then
    echo "❌ .env file not found. Please create it from .env.example"
    exit 1
fi

source .env

# 2. Start the server if not running
if ! lsof -i :3000 > /dev/null 2>&1; then
    echo "🚀 Starting server..."
    npm run dev &
    SERVER_PID=$!
    sleep 3
else
    echo "✅ Server already running on port 3000"
fi

# 3. Open PWA interface
echo "🌐 Opening PWA interface..."
xdg-open http://localhost:3000/sina/interface.html 2>/dev/null || echo "Please open: http://localhost:3000/sina/interface.html"

# 4. Test voice commands
echo "🧪 Testing voice commands..."
echo "Try saying these commands in the PWA:"
echo "  • 'empire' - Query empire infrastructure"
echo "  • 'revenue' - Process revenue"
echo "  • 'Send Darren \$600 demand' - Test revenue generation"

# 5. Simulate a voice command
echo "🎤 Simulating voice command 'empire'..."
curl -X POST http://localhost:3000/mcp/voice \
  -H "Content-Type: application/json" \
  -d '{"command": "empire", "sessionId": "blackbox_test_'"$(date +%s)"'"}' | jq .

# 6. Run CLI command
echo "💻 Running CLI empire command..."
./bulletproof-cli.js empire

echo ""
echo "✅ Blackbox integration ready!"
echo "📋 Instructions:"
echo "1. Use Blackbox voice agent in VS Code"
echo "2. Speak commands like 'empire' or 'revenue'"
echo "3. The PWA will process voice input and execute commands"
echo "4. Check terminal output for command execution"

# Keep server running
if [ -n "$SERVER_PID" ]; then
    echo "🛑 Press Ctrl+C to stop the server"
    wait $SERVER_PID
fi