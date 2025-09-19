# SINA Empire CLI + PWA System

🚀 A complete development environment for building SINA Empire CLI tools and Progressive Web Applications with Cloudflare Workers.

## Features

- **🎯 Bulletproof CLI System** - Advanced command-line interface with voice commands
- **🌐 Progressive Web App** - Modern PWA with offline capabilities
- **⚡ Cloudflare Workers** - Serverless backend with global edge deployment
- **💰 Revenue Tracking** - Built-in analytics and revenue monitoring
- **🎤 Voice Commands** - Speech recognition and voice control
- **🔧 DevContainer Support** - Ready for GitHub Codespaces and VS Code
- **🌍 Gitpod Ready** - One-click cloud development environment

## Quick Start

### 1. Run the Setup Script

```bash
./setup-sina-empire.sh
```

This creates the complete project structure with:
- DevContainer configuration for Codespaces
- Gitpod configuration for cloud development
- Cloudflare Worker setup
- PWA interface files
- CLI tools and scripts

### 2. Install Dependencies and Setup

```bash
npm install
npm run setup
```

### 3. Configure Environment

Update `.env` with your API keys:
```bash
cp .env.example .env
# Edit .env with your actual credentials
```

### 4. Start Development

```bash
npm run dev
```

This starts:
- **Worker**: http://localhost:8787
- **PWA Interface**: http://localhost:8787/sina/interface  
- **PWA Dev Server**: http://localhost:8788
- **CLI Server**: http://localhost:3000

## CLI Commands

The bulletproof CLI provides powerful management capabilities:

```bash
# Check system status
./bulletproof-cli.js status

# Enable voice commands
./bulletproof-cli.js voice

# View revenue dashboard
./bulletproof-cli.js revenue

# Start CLI server
./bulletproof-cli.js server --port 3000

# Deploy to production
./bulletproof-cli.js deploy
```

## Project Structure

```
├── .devcontainer/          # DevContainer configuration
├── .gitpod.yml            # Gitpod configuration
├── worker/                # Cloudflare Worker code
├── public/sina/           # PWA interface files
├── bulletproof-cli.js     # Main CLI application
├── setup-sina-empire.sh   # Complete setup script
├── package.json           # Node.js dependencies
└── wrangler.toml          # Cloudflare configuration
```

## Development Environments

### GitHub Codespaces
The project includes a complete DevContainer configuration. Click "Code" → "Create codespace" to start developing instantly.

### Gitpod
[![Open in Gitpod](https://gitpod.io/button/open-in-gitpod.svg)](https://gitpod.io/#https://github.com/ldeong/-empire-mcp-system)

### Local Development
Requirements:
- Node.js 18+
- npm or yarn
- Cloudflare account (for deployment)

## Scripts

- `npm run setup` - Initial project setup
- `npm run dev` - Start all development servers
- `npm run build` - Build for production
- `npm run test` - Run test suite
- `npm run worker:dev` - Worker development server
- `npm run worker:deploy` - Deploy worker to Cloudflare
- `npm run pwa:dev` - PWA development server

## Voice Commands

The system supports voice control through the CLI:

```bash
./bulletproof-cli.js voice
```

Supported commands:
- "SINA status" - Check system status
- "SINA revenue" - Show revenue dashboard
- "SINA deploy" - Deploy to production

## Revenue Tracking

Built-in revenue analytics provide insights into:
- Monthly revenue tracking
- Premium user metrics
- Growth rate analysis
- Goal completion tracking

Access via:
- CLI: `./bulletproof-cli.js revenue`
- PWA: http://localhost:8787/sina/interface
- API: http://localhost:8787/api/revenue

## Deployment

### Cloudflare Workers
```bash
npm run worker:deploy
```

### PWA
The PWA is served directly from the Cloudflare Worker at `/sina/interface`.

## API Endpoints

- `GET /api/status` - System status
- `GET /api/revenue` - Revenue data
- `POST /api/voice/command` - Voice command processing

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `npm test`
5. Submit a pull request

## License

MIT License - see LICENSE file for details

---

🚀 **SINA Empire** - Building the future of CLI + PWA development