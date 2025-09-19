# SINA Empire CLI + PWA Setup Checklist

Use this checklist in your Codespace/Gitpod terminal. Check off items as you verify them.

| Step | Item | Command / Test | Expected Output | Status | Notes |
|---|---:|---|---|---|---|
|1|Project Structure|`ls -la`|Shows `.devcontainer`, `public/sina`, `worker`, `scripts`|[ ]|If missing, run `mkdir -p .devcontainer public/sina worker scripts`|
|2|DevContainer Config|`cat .devcontainer/devcontainer.json`|JSON with `name: SINA Empire CLI + PWA`, features (docker, github-cli), extensions (copilot, wrangler)|[ ]|Restart Codespace if changed|
|3|Gitpod Config|`cat .gitpod.yml .gitpod.Dockerfile`|YAML with tasks (npm install, setup), ports (8787, 8788, 3000), extensions; Dockerfile with `gitpod/workspace-node` and wrangler|[ ]|Restart Gitpod to apply|
|4|Package.json|`cat package.json`|JSON with dependencies (axios, dotenv, express, etc.), scripts (start, dev, setup, test, status, voice, revenue)|[ ]|If missing, add `package.json` as provided|
|5|Install Dependencies|`npm install`|No errors, `node_modules` directory created|[ ]|If errors: `npm cache clean --force && npm install`|
|6|Setup Script|`npm run setup`|Logs "Setting up SINA Empire...", "Setup complete!"|[ ]|Installs `wrangler`, sets executable bit on CLI|
|7|CLI Test|`./bulletproof-cli.js status`|Outputs empire status JSON|[ ]|Ensure `chmod +x bulletproof-cli.js` if permission denied|
|8|Server Test|`npm run dev & sleep 2; curl -s http://localhost:3000/health`|Server logs "Server running on http://localhost:3000", curl returns `{ status: 'healthy', timestamp: ... }`|[ ]|Kill server with `pkill -f server.js` after test|
|9|PWA Interface|`cat public/sina/interface.html`|HTML with title "SINA Empire Voice Control", voice buttons, chat `div`|[ ]|Open `http://localhost:8787/sina/interface` to verify UI|
|10|Voice Command Test|`curl -X POST http://localhost:3000/mcp/voice -H "Content-Type: application/json" -d '{"command": "revenue", "sessionId": "test_123"}'`|Returns `{ response: '...revenue...', provider: 'SINA' }`|[ ]|Check server logs for "Voice command received"|
|11|Revenue Tracking|`./bulletproof-cli.js revenue`|Outputs response from `/mcp/voice` with revenue data|[ ]|Verify webhook logs at configured `WEBHOOK_URL`|
|12|Git Commit and Push|`git add . && git commit -m "Complete SINA Empire setup" && git push origin dev`|Git logs show commit, push succeeds|[ ]|If push fails, check `git remote -v` and auth|
|13|GitHub Actions Test|`git push origin dev`|GitHub Actions runs; logs show "Test CLI" and "Test Server" pass|[ ]|Check Actions UI for failures|
|14|Worker Deploy|`wrangler login && wrangler deploy`|`Success: Published your application to Cloudflare Workers`|[ ]|Use `CLOUDFLARE_API_TOKEN` if interactive login fails|
|15|Secrets Set|`wrangler secret put XAI_KEY`|`Secret XAI_KEY set`|[ ]|Set each secret: XAI_KEY, GEMINI_API_KEY, etc.
|16|PWA Install Test|Open PWA on phone|`Add to Home Screen` prompt appears|[ ]|Test voice command on phone after install|
|17|Anonymity Test|`./bulletproof-cli.js mcp session test_123` (simulate)|Logs show "Camera feed replaced with static for 3 minutes"|[ ]|Placeholder — add real script if needed|
|18|Revenue Test|`./bulletproof-cli.js mcp revenue darren-pike-123`|Outputs revenue JSON `{api:..., mcp:..., fallback:...}`|[ ]|Check MongoDB `revenue_logs` collection|
|19|Backup Test|`node scripts/backup-mongodb.js`|`MongoDB backup completed`, files in `backups/`|[ ]|Ensure `MONGODB_CONNECTION_STRING` is set|
|20|Full Flow Test|End-to-end commands in CLI and PWA|CLI & PWA respond <5s, revenue logged, TTS plays|[ ]|If slow, check proxy rotation and rate limits|


## How to Use

1. Copy this file into the Codespace and open `CHECKLIST.md` in the editor.
2. Run each command in the table in order.
3. After each successful step, commit as a checkpoint:

```bash
git add .
git commit -m "Complete step [number]: [description]"
git push origin dev
```

## Troubleshooting

- npm Errors: `npm cache clean --force && npm install`
- Wrangler Errors: `wrangler login --scope=cloudflare:api` or set `CLOUDFLARE_API_TOKEN` as GitHub secret
- PWA Not Loading: Check `/sina/pwa-manifest.json` in browser console
- Voice Fails: Ensure ElevenLabs key set and test endpoint with curl

## Scale

To scale agents locally:

```bash
docker-compose up -d --scale sina-empire=20
```


## Git-Centric Enhancements

- Branch per target: `git checkout -b feature/target-darren-pike` and commit `targets/darren-pike/financials.json`.
- Protect `main`: GitHub > Settings > Branches > Add rule to require PR reviews.


## How Grok can help

Grok can automate analysis and validation steps from this checklist:

- Run security scans on the codebase and produce a summary report.
- Validate OpenAPI or API endpoints and ensure health endpoints respond correctly.
- Generate test vectors for voice commands and replay them against the `/mcp/voice` endpoint.
- Produce a summary of required secrets and a `.env.production` template.

Example Grok command (local wrapper):

```bash
./bin/grok "scan repo for missing env vars and health endpoints"
```


---

Checklist created automatically by the assistant. Follow steps and mark completed as you go.
