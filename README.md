# SINA Empire MCP System

A comprehensive MCP (Model Context Protocol) ecosystem for unlimited scaling of Claude API calls into Cloudflare Workers with advanced resilience patterns, voice command parsing, context management, webhook integration, and orchestration engine.

## 🚀 Features

### Core MCP Ecosystem
- **Resilience Patterns**: Exponential backoff, circuit breaker, automatic provider switching
- **Voice Command Parser**: Natural language to MCP command conversion with intent recognition
- **MCP Context Manager**: Persistent session storage with smart context passing
- **Advanced Webhook Integration**: Real-time status broadcasting with revenue tracking
- **MCP Orchestration Engine**: Workflow chaining with conditional logic and parallel execution

### Integration Capabilities
- **Cloudflare Workers**: Unlimited scaling for MCP operations
- **GitHub API**: Repository management and automation
- **Asana API**: Project management and task tracking
- **Auto-commit System**: Automated version control operations
- **Coding Agent**: AI-powered code generation and refactoring

## 📋 Prerequisites

- Node.js 18+
- npm or yarn
- Git
- Environment variables configured (see Configuration section)

## ⚙️ Configuration

Create a `.env` file in the root directory:

```bash
# MCP Ecosystem Configuration
CLOUDFLARE_WORKER_URL=https://your-worker.your-subdomain.workers.dev
GITHUB_TOKEN=your_github_personal_access_token
ASANA_TOKEN=your_asana_personal_access_token
SINA_WEBHOOK_URL=https://your-webhook-endpoint.com/webhook

# Optional: Additional API Keys
OPENAI_API_KEY=your_openai_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key
```

## 🏃‍♂️ Quick Start

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure Environment**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys
   ```

3. **Start the Server**
   ```bash
   npm start
   ```

4. **Test MCP Ecosystem**
   ```bash
   curl -X POST http://localhost:3000/mcp/execute \
     -H "Content-Type: application/json" \
     -d '{"command": "deploy cloudflare worker"}'
   ```

## 📡 API Endpoints

### Voice Command Processing
```http
POST /mcp/voice
Content-Type: application/json

{
  "command": "deploy cloudflare worker with resilience",
  "sessionId": "optional-session-id"
}
```

### MCP Operations
```http
POST /mcp/execute
Content-Type: application/json

{
  "command": "create github repository",
  "sessionId": "session-123"
}
```

### Workflow Execution
```http
POST /mcp/workflow
Content-Type: application/json

{
  "workflowName": "dev-setup",
  "sessionId": "session-123",
  "parameters": {
    "projectName": "my-app",
    "template": "react"
  }
}
```

### System Status
```http
GET /mcp/status
```

### Available Workflows
```http
GET /mcp/workflows
```

### Analytics Dashboard
```http
GET /mcp/analytics?timeframe=1h
```

### Webhook Registration
```http
POST /mcp/webhook/register
Content-Type: application/json

{
  "operationType": "mcp-operation",
  "url": "https://your-webhook.com/callback",
  "filters": {
    "status": "success"
  }
}
```

### Auto-commit Operations
```http
POST /mcp/auto-commit
Content-Type: application/json

{
  "dryRun": false,
  "skipPush": false
}
```

### Coding Agent Tasks
```http
POST /mcp/coding-agent
Content-Type: application/json

{
  "taskType": "feature",
  "title": "Add user authentication",
  "description": "Implement JWT-based authentication system",
  "files": ["auth.js", "middleware.js"]
}
```

## 🎯 Voice Commands

The system supports natural language voice commands for MCP operations:

### Development Commands
- "create new project with react and typescript"
- "set up development environment"
- "deploy application to cloudflare"
- "run automated tests"

### GitHub Operations
- "create github repository for my project"
- "push code to main branch"
- "create pull request for new feature"
- "review code changes"

### Asana Integration
- "create task for implementing user login"
- "update project status to in progress"
- "assign task to team member"

### Workflow Commands
- "run deployment workflow"
- "execute testing pipeline"
- "start continuous integration"

## 🔧 MCP Ecosystem Components

### 1. MCP Resilience Manager
Handles fault tolerance with:
- Exponential backoff for API failures
- Circuit breaker pattern for service protection
- Automatic provider switching
- Request retry logic with jitter

### 2. Voice Command Parser
Converts natural language to MCP commands:
- Intent recognition and classification
- Parameter extraction from speech
- Context-aware command interpretation
- Multi-language support

### 3. MCP Context Manager
Manages persistent sessions:
- Session state persistence
- Smart context passing between operations
- Memory optimization for long conversations
- Context cleanup and archiving

### 4. MCP Webhook Manager
Real-time integration capabilities:
- Operation status broadcasting
- Revenue tracking and analytics
- Custom webhook registration
- Event filtering and routing

### 5. MCP Orchestration Engine
Workflow management system:
- Sequential and parallel execution
- Conditional logic and branching
- Error handling and recovery
- Template-based workflows

## 📊 Monitoring & Analytics

### Real-time Metrics
- Operation success/failure rates
- Response time tracking
- Resource utilization monitoring
- Error pattern analysis

### Dashboard Access
```bash
# View system status
curl http://localhost:3000/mcp/status

# Get analytics data
curl http://localhost:3000/mcp/analytics?timeframe=24h
```

## 🛠️ Development

### Project Structure
```
├── server.js                 # Main server with MCP integration
├── mcp-ecosystem-manager.js  # Core MCP ecosystem implementation
├── scripts/
│   ├── auto-commit.js       # Automated commit system
│   └── coding-agent-trigger.js # AI coding agent
├── worker/                  # Cloudflare Worker code
└── README.md               # This documentation
```

### Adding New Workflows
1. Define workflow in `mcp-ecosystem-manager.js`
2. Register with orchestration engine
3. Test with voice commands
4. Update documentation

### Extending MCP Operations
1. Add new operation types to resilience manager
2. Implement provider-specific handlers
3. Update voice command parser
4. Add webhook events

### Development / Restart Codespace

The MCP system includes a comprehensive Codespaces helper system with self-healing capabilities for development environments.

#### Prerequisites
- **GitHub CLI (gh)**: Required for container restart functionality
- **Node.js 18+**: For running MCP server and helper scripts
- **npm**: For dependency management

#### Quick Start Commands

```bash
# Complete development cycle with health checks and auto-recovery
node scripts/dev-helper.js run

# Start continuous health monitoring
node scripts/dev-helper.js monitor

# Manual health check
node scripts/dev-helper.js health

# Get detailed system status
node scripts/dev-helper.js status

# Restart entire Codespace environment
./scripts/restart-codespace.sh

# Skip container restart (faster for development)
./scripts/restart-codespace.sh --skip-container
```

#### Available Scripts

**`scripts/restart-codespace.sh`** (Executable)
- Stops any running MCP dev server processes
- Restarts Codespace container using GitHub CLI
- Performs clean dependency installation (`npm install`)
- Starts MCP server automatically via `mcp-control.js`
- Runs health checks on `http://localhost:3000/health`
- Comprehensive error handling and logging to `restart-codespace.log`

**`scripts/mcp-control.js`** (Node.js)
- Graceful integration with `mcp-ecosystem-manager.js` when available
- Fallback to `npm start` or `node server.js` if manager unavailable
- Process management for MCP server lifecycle
- Detailed logging to `dev-helper.log`

**`scripts/dev-helper.js`** (Node.js)
- Automated health checks with configurable retries and intervals
- Self-healing agent with exponential backoff recovery
- Runs complete development cycle: install → start → test → verify
- Automatic restart attempts on health/test failures
- Continuous monitoring mode for long-running development

#### Development Helper Options

```bash
# Customize retry behavior
node scripts/dev-helper.js run --max-retries 5 --health-interval 60000

# Use different server URL
node scripts/dev-helper.js health --server-url http://localhost:8080

# Install dependencies only
node scripts/dev-helper.js install
```

#### Self-Healing Features

The development helper system includes:
- **Exponential Backoff**: Intelligent retry delays to avoid overwhelming failed services
- **Health Monitoring**: Continuous checks of `/health` endpoint with configurable intervals
- **Auto-Recovery**: Automatic dependency reinstall and server restart on failures
- **Test Integration**: Runs `test-mcp-ecosystem.js` and attempts recovery on test failures
- **Process Management**: Clean shutdown and restart of MCP server processes

#### Logging and Monitoring

All scripts provide comprehensive logging:
- **`restart-codespace.log`**: Complete restart process logs with timestamps
- **`dev-helper.log`**: Development cycle, health checks, and recovery attempts
- **Console Output**: Real-time status with color-coded messages

#### Example Workflow

```bash
# 1. Start development session
./scripts/restart-codespace.sh

# 2. Run continuous monitoring (in background)
node scripts/dev-helper.js monitor &

# 3. Develop your features...

# 4. Run health check before committing
node scripts/dev-helper.js health

# 5. If issues arise, trigger recovery
node scripts/dev-helper.js run
```

#### Integration with CI/CD

The helper scripts are designed to be compatible with:
- **GitHub Actions**: Use in workflow steps for environment setup
- **Docker**: Scripts work in containerized environments
- **MCP Resilience**: Integrates with existing MCP ecosystem patterns

#### Suggested Improvements

**Dockerization Enhancements:**
- Multi-stage Docker builds for development and production
- Docker Compose setup for local development with dependencies
- Health check integration in Docker containers

**GitHub Actions Integration:**
- Automated Codespace setup workflows
- Self-healing CI/CD pipelines with retry logic
- Integration tests using the dev-helper system
- Automatic environment recovery on workflow failures

**Agent-Ready Architecture:**
- Webhook endpoints for external monitoring systems
- Metrics export for observability platforms
- API endpoints for remote health checks and recovery triggers
- Integration with GitHub Dependabot for automated dependency updates

## 🔒 Security

- API key encryption at rest
- Request rate limiting
- Input validation and sanitization
- Secure webhook communication
- Audit logging for all operations

## 📈 Scaling

The system is designed for unlimited scaling:
- Horizontal scaling with multiple instances
- Load balancing across Cloudflare Workers
- Database connection pooling
- Caching layer for performance
- Auto-scaling based on demand

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Check the documentation
- Review the code examples
- Open an issue on GitHub
- Contact the development team

---

**Built with ❤️ for the SINA Empire ecosystem**

## Deployment (quick reference)

This section contains minimal, copy-paste commands for preparing and deploying the Worker using `wrangler-fixed.toml`.

1. Ensure you have `wrangler` v3+ installed and authenticated:

```bash
npm i -g wrangler
wrangler login
```

2. Set required production secrets (do NOT store secrets in the repo):

```bash
wrangler secret put ADMIN_TOKEN --env production
wrangler secret put CHANGENOW_API_KEY --env production
wrangler secret put ALCHEMY_API_KEY --env production
wrangler secret put CLOUDFLARE_API_TOKEN --env production
wrangler secret put MONERO_WALLET_JSON --env production
```

3. Deploy to staging to smoke-test:

```bash
npx wrangler deploy --config wrangler-fixed.toml --env staging
```

4. Run smoke tests against the staging URL (replace `<STAGING_URL>`):

```bash
curl -s <STAGING_URL>/health
curl -s <STAGING_URL>/api/balance
curl -s -H "cf-connecting-ip: 8.8.8.8" <STAGING_URL>/api/geo
curl -s <STAGING_URL>/api/price
```

5. Deploy to production:

```bash
npx wrangler deploy --config wrangler-fixed.toml --env production
```

Notes:
- `wrangler-fixed.toml` should NOT contain plaintext secrets. The file in the repo has been adjusted to leave `ADMIN_TOKEN` blank and instruct you to set it with `wrangler secret put`.
- If you want a PR that prepares a `deploy-prep` branch (Option B) with CI checks and a deploy checklist, tell me and I'll create it.
