# Manual Setup Guide (Sanitized)

This guide contains copy-pasteable commands to setup the SINA Empire CLI + PWA locally or in a Codespace/Gitpod. Do NOT commit real secrets to the repository — use the scripts in `scripts/` to set CI secrets.

## 1. Clone and switch to dev (if not already)

git clone https://github.com/ldeong/-empire-mcp-system
cd -empire-mcp-system
git checkout -b dev

## 2. Install dependencies

```bash
npm install
npm run setup
```

## 3. Create a local `.env` (sanitized placeholders)

```bash
cat > .env <<'EOF'
XAI_KEY=xai_YOUR_KEY
GEMINI_API_KEY=AIzaYourKey
OPENROUTER_API_KEY=or_your_key
AZURE_OPENAI_API_KEY=az_your_key
AZURE_OPENAI_ENDPOINT=https://gaiax.cognitiveservices.azure.com/openai/deployments/gaiax/chat/completions?api-version=2023-03-15-preview
ELEVEN_LABS_API_KEY=el_your_key
WORKER_URL=https://your-workers-subdomain.workers.dev
WORKER_API_KEY=wk_your_key
CLOUDFLARE_API_TOKEN=
CLOUDFLARE_ACCOUNT_ID=
CLAUDE_API_KEY=
WEBHOOK_URL=
MONGODB_CONNECTION_STRING=
EOF
```

## 4. Run the server and test

```bash
npm run dev &
sleep 2
curl -s http://localhost:3000/health
./bulletproof-cli.js status
```

## 5. Set GitHub Actions secrets (recommended)

Use `gh` (GitHub CLI) to set repository secrets — interactive helper included:

```bash
./scripts/set_github_secrets.sh <owner> <repo>
# then follow prompts to set secrets like CLOUDFLARE_API_TOKEN, XAI_KEY, GEMINI_API_KEY, etc.
```

## 6. Deploy Worker (after secrets configured)

```bash
npm install -g wrangler@latest
wrangler login
wrangler deploy
```

## 7. Set Wrangler secrets (optional)

```bash
./scripts/set_wrangler_secrets.sh XAI_KEY <value>
```

## 8. CI / GitHub Actions

- Push `dev` and open PR -> `main`.
- On `main`, `deploy-worker` action will run and deploy if `CLOUDFLARE_API_TOKEN` is set as a repo secret.

## Notes
- Replace sanitized placeholders with real keys only in local `.env` or secrets in CI.
- For anonymity: use temporary Git identities (local `git config user.name/email`) and use `gh` to create PRs. Do not store tokens on disk.

*** End Manual Setup ***
