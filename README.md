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

## 🔄 Development / Restart Codespace

### Quick Restart Script
The Empire MCP System includes a comprehensive Codespaces restart script for development environments:

```bash
# Full Codespace restart with MCP server reinitialization
./scripts/restart-codespace.sh
```

**What it does:**
- 🛑 Stops any running MCP dev server processes
- 🔄 Restarts the Codespace container (requires GitHub CLI)
- 📦 Reinstalls dependencies (`npm install`)
- 🚀 Starts the MCP server automatically
- 🏥 Performs health checks at `http://localhost:3000/health`
- 📝 Provides detailed logging and error handling

**Requirements:**
- GitHub CLI (`gh`) installed and authenticated
- Node.js 18+ environment
- npm package manager

### Development Helper Script
Advanced development utilities for monitoring and maintaining the MCP ecosystem:

```bash
# Monitor system and auto-fix issues
node scripts/dev-helper.js monitor

# Check server health
node scripts/dev-helper.js health

# Run the complete MCP test suite
node scripts/dev-helper.js test

# Check critical endpoints
node scripts/dev-helper.js endpoints

# Restart MCP server
node scripts/dev-helper.js restart

# Generate status report
node scripts/dev-helper.js report
```

**Key Features:**
- ✅ Health monitoring with automatic retry logic
- 🧪 Automated test suite execution
- 🔄 Intelligent auto-restart on critical failures
- 📊 Comprehensive status reporting
- 🎯 Critical endpoint validation
- 📈 Performance monitoring and analytics

**Auto-Restart Logic:**
The dev-helper automatically restarts the MCP server when:
- Health endpoint returns non-200 status
- Critical endpoints (`/mcp/status`, `/mcp/workflows`) fail
- Server becomes unresponsive

**Usage Examples:**
```bash
# Monitor with custom retry count
node scripts/dev-helper.js health --retries 10

# Use custom base URL
node scripts/dev-helper.js monitor --url http://localhost:8080

# Check if system needs restart
node scripts/dev-helper.js endpoints
if [ $? -ne 0 ]; then
    echo "Critical failures detected, restarting..."
    node scripts/dev-helper.js restart
fi
```

### Codespace Environment Setup

**Manual Setup:**
```bash
# 1. Install dependencies
npm install

# 2. Copy environment template
cp .env.example .env

# 3. Configure environment variables (edit .env)
nano .env

# 4. Start the server
npm start
```

**Verification Commands:**
```bash
# Test server health
curl http://localhost:3000/health

# Run test suite
npm test

# Check development helper
node scripts/dev-helper.js report
```

### Integration with MCP Ecosystem

The restart and development helper scripts are designed to work seamlessly with:

- **🔄 Resilience Mechanisms**: Compatible with circuit breakers and retry logic
- **🎼 Workflow Manager**: Preserves workflow state during restarts
- **🚀 CI/CD Pipeline**: Provides proper exit codes for automation
- **📊 Analytics**: Logs all operations for monitoring
- **🔗 Webhook Integration**: Maintains webhook registrations

### Troubleshooting

**Common Issues:**

1. **GitHub CLI not authenticated:**
   ```bash
   gh auth login
   ```

2. **Port already in use:**
   ```bash
   # Kill processes on port 3000
   pkill -f "node.*server.js"
   lsof -ti:3000 | xargs kill
   ```

3. **Dependencies out of sync:**
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

4. **Health check failures:**
   ```bash
   # Check server logs
   tail -f /tmp/mcp-server.log
   
   # Restart with dev helper
   node scripts/dev-helper.js restart
   ```

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