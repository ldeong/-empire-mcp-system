#!/bin/bash

# SINA Empire Checklist Runner
echo "🔍 Running SINA Empire Checklist..."

# Item 1: Project Structure
ls .devcontainer public/sina worker scripts >/dev/null 2>&1 && echo "1. Project Structure: PASS" || echo "1. Project Structure: FAIL"

# Item 2: DevContainer
[ -f ".devcontainer/devcontainer.json" ] && echo "2. DevContainer: PASS" || echo "2. DevContainer: FAIL"

# Item 3: Gitpod
[ -f ".gitpod.yml" ] && [ -f ".gitpod.Dockerfile" ] && echo "3. Gitpod: PASS" || echo "3. Gitpod: FAIL"

# Item 4: Package.json
[ -f "package.json" ] && echo "4. Package.json: PASS" || echo "4. Package.json: FAIL"

# Item 5: Install Dependencies
npm install >/dev/null 2>&1 && echo "5. Dependencies: PASS" || echo "5. Dependencies: FAIL"

# Item 6: Setup Script
npm run setup >/dev/null 2>&1 && echo "6. Setup Script: PASS" || echo "6. Setup Script: FAIL"

# Item 7: CLI Test
./bulletproof-cli.js status >/dev/null 2>&1 && echo "7. CLI Test: PASS" || echo "7. CLI Test: FAIL"

# Item 8: Server Test
npm run dev >/dev/null 2>&1 & SERVER_PID=$!; sleep 3; curl -s http://localhost:3000/health >/dev/null && echo "8. Server Test: PASS" || echo "8. Server Test: FAIL"; kill $SERVER_PID 2>/dev/null

# Item 9: PWA Interface
[ -f "public/sina/interface.html" ] && echo "9. PWA Interface: PASS" || echo "9. PWA Interface: FAIL"

# Item 10: Voice Command Test
npm run dev >/dev/null 2>&1 & SERVER_PID=$!; sleep 3; curl -X POST http://localhost:3000/mcp/voice -H "Content-Type: application/json" -d '{"command": "revenue", "sessionId": "test_123"}' >/dev/null && echo "10. Voice Command Test: PASS" || echo "10. Voice Command Test: FAIL"; kill $SERVER_PID 2>/dev/null

# Item 11: Revenue Tracking
./bulletproof-cli.js revenue >/dev/null 2>&1 && echo "11. Revenue Tracking: PASS" || echo "11. Revenue Tracking: FAIL"

# Item 12: Git Commit and Push
git add . >/dev/null 2>&1 && git commit -m "Test commit" >/dev/null 2>&1 && echo "12. Git Commit: PASS" || echo "12. Git Commit: FAIL"; git reset --soft HEAD~1 2>/dev/null

# Item 13: GitHub Actions Test
echo "13. GitHub Actions: MANUAL - Check https://github.com/ldeong/-empire-mcp-system/actions"

# Item 14: Worker Deploy
wrangler deploy >/dev/null 2>&1 && echo "14. Worker Deploy: PASS" || echo "14. Worker Deploy: FAIL"

# Item 15: Secrets Set
echo "15. Secrets Set: MANUAL - Run 'wrangler secret put XAI_KEY' for each key"

# Item 16: PWA Install Test
echo "16. PWA Install Test: MANUAL - Open http://localhost:8787/sina/interface, add to home screen"

# Item 17: Anonymity Test
echo "17. Anonymity Test: MANUAL - Run './bulletproof-cli.js mcp session test_123' and check logs"

# Item 18: Revenue Test
./bulletproof-cli.js mcp revenue darren-pike-123 >/dev/null 2>&1 && echo "18. Revenue Test: PASS" || echo "18. Revenue Test: FAIL"

# Item 19: Backup Test
[ -f "scripts/backup-mongodb.js" ] && node scripts/backup-mongodb.js >/dev/null 2>&1 && echo "19. Backup Test: PASS" || echo "19. Backup Test: FAIL"

# Item 20: Full Flow Test
./bulletproof-cli.js mcp genealogy test_123 >/dev/null 2>&1 && echo "20. Full Flow Test: PASS" || echo "20. Full Flow Test: FAIL"

echo "✅ Checklist complete! Fix any FAILs and run 'npm run dev' to test PWA voice."