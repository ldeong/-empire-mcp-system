#!/usr/bin/env node
/**
 * scripts/agent-orchestrator.js
 * MCP Orchestrator Agent for SINA Empire MCP System
 * 
 * Orchestrates MCP workflows, monitors system health, and coordinates
 * between multiple MCP providers with WebSocket communication support.
 * 
 * Usage: 
 *   DRY_RUN=true node scripts/agent-orchestrator.js
 *   MCP_WS_URL=wss://your-ws-endpoint node scripts/agent-orchestrator.js
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');
const { SinaMCPManager } = require('../mcp-ecosystem-manager.js');

const LOG_FILE = path.join(process.cwd(), 'logs', 'orchestrator.log');
const DRY_RUN = process.env.DRY_RUN === 'true';
const MCP_WS_URL = process.env.MCP_WS_URL || 'ws://localhost:8080';

// Ensure logs directory exists
if (!fs.existsSync(path.dirname(LOG_FILE))) {
  fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
}

function log(msg) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${msg}`;
  console.log(logMessage);
  
  try {
    fs.appendFileSync(LOG_FILE, logMessage + '\n');
  } catch (err) {
    console.error('Failed to write to log file:', err.message);
  }
}

function fail(msg) {
  log(`ERROR: ${msg}`);
  process.exit(1);
}

class MCPOrchestrator {
  constructor() {
    this.mcpManager = new SinaMCPManager();
    this.ws = null;
    this.isConnected = false;
    this.healthCheckInterval = null;
    this.workflowQueue = [];
    this.activeWorkflows = new Map();
  }

  /**
   * Initialize WebSocket connection
   */
  async initializeWebSocket() {
    if (DRY_RUN) {
      log('DRY_RUN: Skipping WebSocket initialization');
      return true;
    }

    return new Promise((resolve, reject) => {
      try {
        log(`Connecting to WebSocket: ${MCP_WS_URL}`);
        this.ws = new WebSocket(MCP_WS_URL);

        this.ws.on('open', () => {
          log('WebSocket connection established');
          this.isConnected = true;
          this.setupWebSocketHandlers();
          resolve(true);
        });

        this.ws.on('error', (error) => {
          log(`WebSocket error: ${error.message}`);
          if (!this.isConnected) {
            reject(error);
          }
        });

        this.ws.on('close', () => {
          log('WebSocket connection closed');
          this.isConnected = false;
          this.attemptReconnect();
        });

        // Timeout after 10 seconds
        setTimeout(() => {
          if (!this.isConnected) {
            reject(new Error('WebSocket connection timeout'));
          }
        }, 10000);

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Setup WebSocket message handlers
   */
  setupWebSocketHandlers() {
    this.ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        log(`Received WebSocket message: ${message.type}`);
        
        await this.handleWebSocketMessage(message);
      } catch (error) {
        log(`Error processing WebSocket message: ${error.message}`);
      }
    });
  }

  /**
   * Handle incoming WebSocket messages
   */
  async handleWebSocketMessage(message) {
    switch (message.type) {
      case 'execute_workflow':
        await this.executeWorkflow(message.payload);
        break;
      case 'health_check':
        await this.performHealthCheck();
        break;
      case 'status_request':
        await this.sendStatus();
        break;
      default:
        log(`Unknown message type: ${message.type}`);
    }
  }

  /**
   * Execute MCP workflow
   */
  async executeWorkflow(payload) {
    const { workflowName, sessionId, parameters = {} } = payload;
    
    if (DRY_RUN) {
      log(`DRY_RUN: Would execute workflow ${workflowName} with session ${sessionId}`);
      return { success: true, dryRun: true };
    }

    try {
      log(`Executing workflow: ${workflowName} (session: ${sessionId})`);
      
      const workflowId = `${workflowName}-${sessionId}-${Date.now()}`;
      this.activeWorkflows.set(workflowId, {
        name: workflowName,
        sessionId,
        startTime: new Date(),
        status: 'running'
      });

      const result = await this.mcpManager.executeWorkflow(workflowName, sessionId, parameters);
      
      this.activeWorkflows.set(workflowId, {
        ...this.activeWorkflows.get(workflowId),
        status: result.success ? 'completed' : 'failed',
        endTime: new Date(),
        result
      });

      log(`Workflow ${workflowName} completed: ${result.success ? 'SUCCESS' : 'FAILED'}`);
      
      // Send result via WebSocket
      if (this.isConnected) {
        this.ws.send(JSON.stringify({
          type: 'workflow_result',
          workflowId,
          result
        }));
      }

      return result;
    } catch (error) {
      log(`Workflow execution failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Perform system health check
   */
  async performHealthCheck() {
    if (DRY_RUN) {
      log('DRY_RUN: Would perform health check');
      return { healthy: true, dryRun: true };
    }

    try {
      const healthStatus = {
        timestamp: new Date().toISOString(),
        orchestrator: 'healthy',
        mcp_providers: {},
        active_workflows: this.activeWorkflows.size,
        websocket: this.isConnected ? 'connected' : 'disconnected'
      };

      // Check MCP providers
      if (this.mcpManager.resilienceManager) {
        for (const [providerName, provider] of Object.entries(this.mcpManager.resilienceManager.providers)) {
          healthStatus.mcp_providers[providerName] = provider.status;
        }
      }

      log(`Health check completed: ${JSON.stringify(healthStatus)}`);
      
      // Send health status via WebSocket
      if (this.isConnected) {
        this.ws.send(JSON.stringify({
          type: 'health_status',
          status: healthStatus
        }));
      }

      return healthStatus;
    } catch (error) {
      log(`Health check failed: ${error.message}`);
      return { healthy: false, error: error.message };
    }
  }

  /**
   * Send current status
   */
  async sendStatus() {
    const status = {
      timestamp: new Date().toISOString(),
      active_workflows: Array.from(this.activeWorkflows.entries()).map(([id, workflow]) => ({
        id,
        ...workflow
      })),
      queue_size: this.workflowQueue.length,
      connected: this.isConnected
    };

    if (this.isConnected) {
      this.ws.send(JSON.stringify({
        type: 'status_response',
        status
      }));
    }

    log(`Status sent: ${JSON.stringify(status)}`);
  }

  /**
   * Attempt WebSocket reconnection
   */
  async attemptReconnect() {
    if (DRY_RUN) return;

    log('Attempting WebSocket reconnection in 5 seconds...');
    setTimeout(async () => {
      try {
        await this.initializeWebSocket();
      } catch (error) {
        log(`Reconnection failed: ${error.message}`);
        this.attemptReconnect();
      }
    }, 5000);
  }

  /**
   * Start health check monitoring
   */
  startHealthMonitoring() {
    if (DRY_RUN) {
      log('DRY_RUN: Would start health monitoring');
      return;
    }

    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthCheck();
    }, 30000); // Every 30 seconds

    log('Health monitoring started (30s interval)');
  }

  /**
   * Stop orchestrator and cleanup
   */
  async stop() {
    log('Stopping MCP Orchestrator...');
    
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    if (this.ws) {
      this.ws.close();
    }

    log('MCP Orchestrator stopped');
  }

  /**
   * Start the orchestrator
   */
  async start() {
    try {
      log('===== MCP Orchestrator Agent Starting =====');
      log(`DRY_RUN: ${DRY_RUN}`);
      log(`MCP_WS_URL: ${MCP_WS_URL}`);

      // Initialize WebSocket connection
      await this.initializeWebSocket();

      // Start health monitoring
      this.startHealthMonitoring();

      // Perform initial health check
      await this.performHealthCheck();

      log('MCP Orchestrator Agent started successfully');

      // Handle graceful shutdown
      process.on('SIGTERM', () => this.stop());
      process.on('SIGINT', () => this.stop());

      if (DRY_RUN) {
        log('DRY_RUN: Orchestrator would run indefinitely. Exiting.');
        return;
      }

      // Keep process alive
      return new Promise(() => {});

    } catch (error) {
      fail(`Failed to start MCP Orchestrator: ${error.message}`);
    }
  }
}

// Main execution
async function main() {
  const orchestrator = new MCPOrchestrator();
  await orchestrator.start();
}

if (require.main === module) {
  main().catch(error => {
    fail(`Orchestrator startup failed: ${error.message}`);
  });
}

module.exports = MCPOrchestrator;