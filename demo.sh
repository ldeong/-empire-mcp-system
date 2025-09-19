#!/bin/bash

# 🚀 SINA Empire Demo Script
# Demonstrates the complete setup and functionality

echo "🚀 SINA Empire CLI + PWA Complete Demo"
echo "========================================"
echo ""

echo "📋 Checking project structure..."
echo "✅ Setup script: $(ls -la setup-sina-empire.sh | awk '{print $1, $9}')"
echo "✅ CLI script: $(ls -la bulletproof-cli.js | awk '{print $1, $9}')"
echo "✅ Package.json: $(ls -la package.json | awk '{print $9}')"
echo "✅ DevContainer: $(ls -la .devcontainer/devcontainer.json | awk '{print $9}')"
echo "✅ Gitpod config: $(ls -la .gitpod.yml | awk '{print $9}')"
echo "✅ Worker code: $(ls -la worker/index.js | awk '{print $9}')"
echo "✅ PWA interface: $(ls -la public/sina/index.html | awk '{print $9}')"
echo ""

echo "🧪 Running tests..."
npm test
echo ""

echo "🎯 CLI Commands Demo:"
echo "--------------------"
echo "Status command:"
./bulletproof-cli.js status
echo ""

echo "Revenue command:"
./bulletproof-cli.js revenue
echo ""

echo "Voice command:"
./bulletproof-cli.js voice
echo ""

echo "📊 Project Statistics:"
echo "---------------------"
echo "Total files created: $(find . -type f ! -path './.git/*' ! -path './node_modules/*' | wc -l)"
echo "Configuration files: $(find . -name "*.json" -o -name "*.yml" -o -name "*.toml" | wc -l)"
echo "JavaScript files: $(find . -name "*.js" | wc -l)"
echo "HTML/PWA files: $(find . -name "*.html" -o -name "*.css" | wc -l)"
echo ""

echo "🌐 Service URLs:"
echo "---------------"
echo "Worker API: http://localhost:8787"
echo "PWA Interface: http://localhost:8787/sina/interface"
echo "PWA Dev Server: http://localhost:8788/sina/"
echo "CLI Server: http://localhost:3000"
echo ""

echo "✨ Setup Complete! Ready for development!"
echo "Next steps:"
echo "1. Update .env with your API keys"
echo "2. Run: npm run dev"
echo "3. Open any of the URLs above"
echo ""
echo "🚀 SINA Empire - Building the future! 🚀"