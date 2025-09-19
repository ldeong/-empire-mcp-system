#!/usr/bin/env node

// Sina Empire - MCP GitHub Integration Connection Stabilizer
// mcp-github-connector.js - Resolve connection issues and maintain stable MCP links

import { WebSocket } from 'ws';
import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';
import { spawn } from 'child_process';

const MCP_CONFIG = {
    GITHUB_WORKBENCH_URL: 'https://assets.github.dev/stable/0f0d87fa9e96c856c5212fc86db137ac0d783365/out/vs/workbench/workbench.web.main.internal.js',
    MCP_SERVER_PORT: process.env.MCP_SERVER_PORT || 3001,
    RECONNECTION_ATTEMPTS: 5,
    RECONNECTION_DELAY: 2000,
    HEARTBEAT_INTERVAL: 30000,
    
    // Connection endpoints
    LOCAL_MCP_SERVER: `ws://localhost:3001/mcp`,
    GITHUB_COPILOT_ENDPOINT: 'wss://copilot-proxy.githubusercontent.com/v1/engines/copilot-codex/completions',
    
    // Configuration paths
    MCP_CONFIG_FILE: './config/mcp-config.json',
    CONNECTION_LOG: './logs/mcp-connections.log',
    
    // GitHub integration
    GITHUB_TOKEN: process.env.GITHUB_TOKEN,
    REPOSITORY_PATH: process.env.GITHUB_REPO || 'sina-empire/autonomous-system'
};

class MCPGitHubConnector {
    constructor() {
        this.connections = new Map();
        this.reconnectionAttempts = new Map();
        this.heartbeatIntervals = new Map();
        this.isInitialized = false;
        
        this.initializeConnector();
    }

    async initializeConnector() {
        console.log('🔗 Initializing MCP GitHub Connector...');
        
        try {
            // Create necessary directories
            await this.createDirectories();
            
            // Load or create MCP configuration
            await this.loadMCPConfiguration();
            
            // Start local MCP server
            await this.startLocalMCPServer();
            
            // Establish GitHub connections
            await this.connectToGitHub();
            
            // Setup connection monitoring
            this.setupConnectionMonitoring();
            
            this.isInitialized = true;
            console.log('✅ MCP GitHub Connector initialized successfully');
            
        } catch (error) {
            console.error('❌ MCP Connector initialization failed:', error.message);
            throw error;
        }
    }

    async createDirectories() {
        const dirs = ['./config', './logs', './temp'];
        for (const dir of dirs) {
            await fs.mkdir(dir, { recursive: true });
        }
    }

    async loadMCPConfiguration() {
        try {
            const configData = await fs.readFile(MCP_CONFIG.MCP_CONFIG_FILE, 'utf8');
            this.mcpConfig = JSON.parse(configData);
            console.log('📁 MCP configuration loaded');
        } catch (error) {
            // Create default configuration
            this.mcpConfig = {
                server_port: MCP_CONFIG.MCP_SERVER_PORT,
                github_integration: true,
                auto_reconnect: true,
                connection_timeout: 10000,
                max_retries: 5,
                services: {
                    sina_empire_agents: {
                        enabled: true,
                        endpoints: ['/agents', '/deploy', '/status'],
                        auth_required: false
                    },
                    wallet_integration: {
                        enabled: true,
                        endpoints: ['/wallets', '/transactions', '/verify'],
                        auth_required: true
                    },
                    pipeline_management: {
                        enabled: true,
                        endpoints: ['/leads', '/qualify', '/convert'],
                        auth_required: false
                    }
                }
            };
            
            await fs.writeFile(MCP_CONFIG.MCP_CONFIG_FILE, JSON.stringify(this.mcpConfig, null, 2));
            console.log('📝 Default MCP configuration created');
        }
    }

    async startLocalMCPServer() {
        return new Promise((resolve, reject) => {
            try {
                // Start MCP server process
                this.mcpServerProcess = spawn('node', ['./mcp-server.js'], {
                    stdio: 'pipe',
                    env: {
                        ...process.env,
                        MCP_PORT: MCP_CONFIG.MCP_SERVER_PORT,
                        GITHUB_INTEGRATION: 'true'
                    }
                });

                this.mcpServerProcess.stdout.on('data', (data) => {
                    console.log(`MCP Server: ${data}`);
                    if (data.includes('Server running on port')) {
                        resolve();
                    }
                });

                this.mcpServerProcess.stderr.on('data', (data) => {
                    console.error(`MCP Server Error: ${data}`);
                });

                this.mcpServerProcess.on('close', (code) => {
                    console.log(`MCP Server process exited with code ${code}`);
                    if (code !== 0) {
                        this.handleServerCrash();
                    }
                });

                // Timeout if server doesn't start
                setTimeout(() => {
                    reject(new Error('MCP Server startup timeout'));
                }, 10000);

            } catch (error) {
                reject(error);
            }
        });
    }

    async connectToGitHub() {
        console.log('🔗 Establishing GitHub connections...');
        
        try {
            // Connection 1: GitHub Workbench WebSocket
            await this.connectToGitHubWorkbench();
            
            // Connection 2: GitHub Copilot API
            await this.connectToGitHubCopilot();
            
            // Connection 3: GitHub Repository API
            await this.connectToGitHubRepo();
            
            console.log('✅ All GitHub connections established');
            
        } catch (error) {
            console.error('❌ GitHub connection failed:', error.message);
            throw error;
        }
    }

    async connectToGitHubWorkbench() {
        return new Promise((resolve, reject) => {
            const connectionId = 'github-workbench';
            
            try {
                // Extract WebSocket endpoint from GitHub workbench URL
                const wsEndpoint = this.extractWebSocketEndpoint(MCP_CONFIG.GITHUB_WORKBENCH_URL);
                
                const ws = new WebSocket(wsEndpoint, {
                    headers: {
                        'User-Agent': 'Sina-Empire-MCP-Connector/1.0',
                        'Authorization': `token ${MCP_CONFIG.GITHUB_TOKEN}`
                    }
                });

                ws.on('open', () => {
                    console.log('✅ GitHub Workbench WebSocket connected');
                    this.connections.set(connectionId, ws);
                    this.setupHeartbeat(connectionId, ws);
                    resolve(ws);
                });

                ws.on('message', (data) => {
                    this.handleWorkbenchMessage(data);
                });

                ws.on('error', (error) => {
                    console.error(`❌ GitHub Workbench error: ${error.message}`);
                    this.handleConnectionError(connectionId, error);
                });

                ws.on('close', () => {
                    console.log('🔌 GitHub Workbench connection closed');
                    this.handleConnectionClose(connectionId);
                });

                // Timeout if connection fails
                setTimeout(() => {
                    if (ws.readyState !== WebSocket.OPEN) {
                        reject(new Error('GitHub Workbench connection timeout'));
                    }
                }, 10000);

            } catch (error) {
                reject(error);
            }
        });
    }

    extractWebSocketEndpoint(workbenchUrl) {
        // Convert GitHub workbench URL to WebSocket endpoint
        const url = new URL(workbenchUrl);
        url.protocol = 'wss:';
        url.pathname = '/ws';
        return url.toString();
    }

    async connectToGitHubCopilot() {
        return new Promise((resolve, reject) => {
            const connectionId = 'github-copilot';
            
            try {
                const ws = new WebSocket(MCP_CONFIG.GITHUB_COPILOT_ENDPOINT, {
                    headers: {
                        'Authorization': `Bearer ${MCP_CONFIG.GITHUB_TOKEN}`,
                        'X-Request-Id': `sina-empire-${Date.now()}`,
                        'User-Agent': 'Sina-Empire-MCP/1.0'
                    }
                });

                ws.on('open', () => {
                    console.log('✅ GitHub Copilot WebSocket connected');
                    this.connections.set(connectionId, ws);
                    this.setupHeartbeat(connectionId, ws);
                    
                    // Send initialization message
                    ws.send(JSON.stringify({
                        type: 'initialize',
                        client: 'sina-empire-mcp',
                        version: '1.0.0',
                        capabilities: ['code_completion', 'code_generation', 'debugging']
                    }));
                    
                    resolve(ws);
                });

                ws.on('message', (data) => {
                    this.handleCopilotMessage(data);
                });

                ws.on('error', (error) => {
                    console.error(`❌ GitHub Copilot error: ${error.message}`);
                    this.handleConnectionError(connectionId, error);
                });

                ws.on('close', () => {
                    console.log('🔌 GitHub Copilot connection closed');
                    this.handleConnectionClose(connectionId);
                });

            } catch (error) {
                reject(error);
            }
        });
    }

    async connectToGitHubRepo() {
        const connectionId = 'github-repo';
        
        try {
            // Test GitHub API connection
            const response = await axios.get(`https://api.github.com/repos/${MCP_CONFIG.REPOSITORY_PATH}`, {
                headers: {
                    'Authorization': `token ${MCP_CONFIG.GITHUB_TOKEN}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'Sina-Empire-MCP'
                }
            });

            console.log('✅ GitHub Repository API connected');
            
            // Store API client
            this.connections.set(connectionId, {
                type: 'http',
                baseURL: 'https://api.github.com',
                headers: {
                    'Authorization': `token ${MCP_CONFIG.GITHUB_TOKEN}`,
                    'Accept': 'application/vnd.github.v3+json'
                },
                repository: MCP_CONFIG.REPOSITORY_PATH
            });
            
            return response.data;
            
        } catch (error) {
            console.error(`❌ GitHub Repository API error: ${error.message}`);
            throw error;
        }
    }

    setupHeartbeat(connectionId, ws) {
        const interval = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.ping();
            } else {
                clearInterval(interval);
                this.heartbeatIntervals.delete(connectionId);
            }
        }, MCP_CONFIG.HEARTBEAT_INTERVAL);
        
        this.heartbeatIntervals.set(connectionId, interval);
    }

    setupConnectionMonitoring() {
        console.log('🔍 Setting up connection monitoring...');
        
        // Monitor all connections every 30 seconds
        setInterval(async () => {
            await this.checkAllConnections();
        }, 30000);
        
        // Detailed health check every 5 minutes
        setInterval(async () => {
            await this.performHealthCheck();
        }, 300000);
    }

    async checkAllConnections() {
        for (const [connectionId, connection] of this.connections.entries()) {
            if (connection.readyState && connection.readyState !== WebSocket.OPEN) {
                console.log(`🔄 Reconnecting ${connectionId}...`);
                await this.reconnectConnection(connectionId);
            }
        }
    }

    async reconnectConnection(connectionId) {
        const attempts = this.reconnectionAttempts.get(connectionId) || 0;
        
        if (attempts >= MCP_CONFIG.RECONNECTION_ATTEMPTS) {
            console.error(`❌ Max reconnection attempts reached for ${connectionId}`);
            return false;
        }
        
        this.reconnectionAttempts.set(connectionId, attempts + 1);
        
        try {
            // Wait before reconnecting
            await new Promise(resolve => setTimeout(resolve, MCP_CONFIG.RECONNECTION_DELAY * attempts));
            
            switch (connectionId) {
                case 'github-workbench':
                    await this.connectToGitHubWorkbench();
                    break;
                case 'github-copilot':
                    await this.connectToGitHubCopilot();
                    break;
                case 'github-repo':
                    await this.connectToGitHubRepo();
                    break;
            }
            
            // Reset attempts on successful reconnection
            this.reconnectionAttempts.set(connectionId, 0);
            console.log(`✅ Successfully reconnected ${connectionId}`);
            return true;
            
        } catch (error) {
            console.error(`❌ Reconnection failed for ${connectionId}: ${error.message}`);
            return false;
        }
    }

    handleWorkbenchMessage(data) {
        try {
            const message = JSON.parse(data.toString());
            console.log('📨 Workbench message:', message.type || 'unknown');
            
            // Route message to appropriate handler
            switch (message.type) {
                case 'code_request':
                    this.handleCodeRequest(message);
                    break;
                case 'deployment_trigger':
                    this.handleDeploymentTrigger(message);
                    break;
                case 'status_inquiry':
                    this.handleStatusInquiry(message);
                    break;
            }
            
        } catch (error) {
            console.error('❌ Failed to parse workbench message:', error.message);
        }
    }

    handleCopilotMessage(data) {
        try {
            const message = JSON.parse(data.toString());
            console.log('🤖 Copilot message:', message.type || 'completion');
            
            // Handle code completions and suggestions
            if (message.type === 'completion') {
                this.processCopilotCompletion(message);
            }
            
        } catch (error) {
            console.error('❌ Failed to parse Copilot message:', error.message);
        }
    }

    handleConnectionError(connectionId, error) {
        console.error(`🚨 Connection error for ${connectionId}: ${error.message}`);
        
        // Log error
        this.logConnectionEvent(connectionId, 'error', error.message);
        
        // Attempt immediate reconnection
        setTimeout(() => {
            this.reconnectConnection(connectionId);
        }, 1000);
    }

    handleConnectionClose(connectionId) {
        console.log(`🔌 Connection closed: ${connectionId}`);
        
        // Clean up heartbeat
        const interval = this.heartbeatIntervals.get(connectionId);
        if (interval) {
            clearInterval(interval);
            this.heartbeatIntervals.delete(connectionId);
        }
        
        // Remove from connections
        this.connections.delete(connectionId);
        
        // Log event
        this.logConnectionEvent(connectionId, 'close', 'Connection closed');
        
        // Attempt reconnection
        setTimeout(() => {
            this.reconnectConnection(connectionId);
        }, MCP_CONFIG.RECONNECTION_DELAY);
    }

    async handleCodeRequest(message) {
        console.log('💻 Processing code request...');
        
        try {
            // Forward to appropriate service
            const response = await this.forwardToLocalMCP({
                type: 'code_generation',
                payload: message.payload
            });
            
            // Send response back through workbench connection
            const workbenchConnection = this.connections.get('github-workbench');
            if (workbenchConnection && workbenchConnection.readyState === WebSocket.OPEN) {
                workbenchConnection.send(JSON.stringify({
                    type: 'code_response',
                    request_id: message.id,
                    payload: response
                }));
            }
            
        } catch (error) {
            console.error('❌ Code request failed:', error.message);
        }
    }

    async handleDeploymentTrigger(message) {
        console.log('🚀 Processing deployment trigger...');
        
        try {
            // Trigger deployment through local MCP
            const response = await this.forwardToLocalMCP({
                type: 'deployment',
                payload: message.payload
            });
            
            console.log('✅ Deployment triggered successfully');
            
        } catch (error) {
            console.error('❌ Deployment trigger failed:', error.message);
        }
    }

    async forwardToLocalMCP(request) {
        try {
            const response = await axios.post(`http://localhost:${MCP_CONFIG.MCP_SERVER_PORT}/mcp/request`, request, {
                timeout: 10000
            });
            
            return response.data;
            
        } catch (error) {
            console.error('❌ Local MCP forward failed:', error.message);
            throw error;
        }
    }

    async performHealthCheck() {
        console.log('🏥 Performing comprehensive health check...');
        
        const healthStatus = {
            timestamp: new Date().toISOString(),
            connections: {},
            mcp_server: 'unknown',
            overall_status: 'healthy'
        };
        
        // Check each connection
        for (const [connectionId, connection] of this.connections.entries()) {
            let status = 'healthy';
            
            if (connection.readyState) {
                status = connection.readyState === WebSocket.OPEN ? 'healthy' : 'disconnected';
            } else if (connection.type === 'http') {
                // Test HTTP connection
                try {
                    await axios.get(`${connection.baseURL}/`, { 
                        headers: connection.headers,
                        timeout: 5000 
                    });
                    status = 'healthy';
                } catch {
                    status = 'error';
                }
            }
            
            healthStatus.connections[connectionId] = status;
            
            if (status !== 'healthy') {
                healthStatus.overall_status = 'warning';
            }
        }
        
        // Check MCP server
        try {
            await axios.get(`http://localhost:${MCP_CONFIG.MCP_SERVER_PORT}/health`, { timeout: 5000 });
            healthStatus.mcp_server = 'healthy';
        } catch {
            healthStatus.mcp_server = 'error';
            healthStatus.overall_status = 'error';
        }
        
        console.log(`🏥 Health check complete: ${healthStatus.overall_status}`);
        
        // Log health status
        await this.logHealthCheck(healthStatus);
        
        return healthStatus;
    }

    async logConnectionEvent(connectionId, event, details) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            connection_id: connectionId,
            event: event,
            details: details
        };
        
        try {
            await fs.appendFile(MCP_CONFIG.CONNECTION_LOG, JSON.stringify(logEntry) + '\n');
        } catch (error) {
            console.error('❌ Failed to write connection log:', error.message);
        }
    }

    async logHealthCheck(healthStatus) {
        try {
            const logFile = `./logs/health-check-${new Date().toISOString().split('T')[0]}.json`;
            const logData = await fs.readFile(logFile, 'utf8').catch(() => '[]');
            const healthLogs = JSON.parse(logData);
            
            healthLogs.push(healthStatus);
            
            await fs.writeFile(logFile, JSON.stringify(healthLogs, null, 2));
        } catch (error) {
            console.error('❌ Failed to write health check log:', error.message);
        }
    }

    handleServerCrash() {
        console.log('🚨 MCP Server crashed, attempting restart...');
        
        setTimeout(async () => {
            try {
                await this.startLocalMCPServer();
                console.log('✅ MCP Server restarted successfully');
            } catch (error) {
                console.error('❌ MCP Server restart failed:', error.message);
            }
        }, 5000);
    }

    // =============================================
    // PUBLIC API METHODS
    // =============================================

    async getConnectionStatus() {
        const status = {};
        
        for (const [connectionId, connection] of this.connections.entries()) {
            if (connection.readyState !== undefined) {
                status[connectionId] = {
                    type: 'websocket',
                    status: connection.readyState === WebSocket.OPEN ? 'connected' : 'disconnected',
                    ready_state: connection.readyState
                };
            } else if (connection.type === 'http') {
                status[connectionId] = {
                    type: 'http',
                    status: 'configured',
                    base_url: connection.baseURL
                };
            }
        }
        
        return status;
    }

    async forceReconnectAll() {
        console.log('🔄 Force reconnecting all connections...');
        
        const connectionIds = Array.from(this.connections.keys());
        const results = {};
        
        for (const connectionId of connectionIds) {
            results[connectionId] = await this.reconnectConnection(connectionId);
        }
        
        return results;
    }

    async shutdown() {
        console.log('🛑 Shutting down MCP GitHub Connector...');
        
        // Close all WebSocket connections
        for (const [connectionId, connection] of this.connections.entries()) {
            if (connection.close) {
                connection.close();
            }
        }
        
        // Clear all heartbeat intervals
        for (const interval of this.heartbeatIntervals.values()) {
            clearInterval(interval);
        }
        
        // Terminate MCP server process
        if (this.mcpServerProcess) {
            this.mcpServerProcess.kill();
        }
        
        console.log('✅ MCP GitHub Connector shutdown complete');
    }

    // =============================================
    // CLI INTERFACE
    // =============================================

    async runCommand(command, args = []) {
        if (!this.isInitialized) {
            await this.initializeConnector();
        }
        
        switch (command) {
            case 'status':
                return await this.getConnectionStatus();
                
            case 'health':
                return await this.performHealthCheck();
                
            case 'reconnect':
                const connectionId = args[0];
                if (connectionId) {
                    return await this.reconnectConnection(connectionId);
                } else {
                    return await this.forceReconnectAll();
                }
                
            case 'logs':
                const logsData = await fs.readFile(MCP_CONFIG.CONNECTION_LOG, 'utf8');
                return logsData.split('\n').filter(line => line.trim()).map(line => JSON.parse(line));
                
            case 'config':
                return this.mcpConfig;
                
            default:
                console.log('Available commands:');
                console.log('  status - Show connection status');
                console.log('  health - Perform health check');
                console.log('  reconnect [connection_id] - Reconnect connections');
                console.log('  logs - Show connection logs');
                console.log('  config - Show current configuration');
        }
    }
}

// =============================================
// CLI EXECUTION
// =============================================

if (import.meta.url === `file://${process.argv[1]}`) {
    const connector = new MCPGitHubConnector();
    const [,, command, ...args] = process.argv;
    
    if (command) {
        connector.runCommand(command, args).then(result => {
            if (result) console.log(JSON.stringify(result, null, 2));
        }).catch(console.error);
    } else {
        connector.getConnectionStatus().then(status => {
            console.log('🔗 MCP GITHUB CONNECTION STATUS');
            console.log('================================');
            console.log(JSON.stringify(status, null, 2));
        }).catch(console.error);
    }
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
        await connector.shutdown();
        process.exit(0);
    });
}

export { MCPGitHubConnector };