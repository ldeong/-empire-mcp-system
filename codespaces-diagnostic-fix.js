#!/usr/bin/env node

// Sina Empire - GitHub Codespaces Diagnostic Fix & Bypass
// codespaces-diagnostic-fix.js - Resolve 504 Gateway Timeout and establish stable connections

import axios from 'axios';
import { WebSocket } from 'ws';
import fs from 'fs/promises';
import crypto from 'crypto';

const DIAGNOSTIC_CONFIG = {
    CODESPACES_URL: 'shiny-dollop-wr4x565wqv542gx7p.github.dev',
    DIAGNOSTIC_ENDPOINT: '/diagnostic',
    TIMEOUT_DURATION: 60000, // 1 minute - current timeout
    RETRY_ATTEMPTS: 5,
    RETRY_DELAY: 2000,
    
    // Bypass configuration
    BYPASS_MODE: true,
    LOCAL_DIAGNOSTIC_PORT: 3002,
    FALLBACK_ENDPOINTS: [
        'https://api.github.com/zen', // Simple GitHub API test
        'https://httpbin.org/get',    // Basic HTTP test
        'https://jsonplaceholder.typicode.com/posts/1' // JSON response test
    ],
    
    // Connection optimization
    HTTP_AGENT_OPTIONS: {
        keepAlive: true,
        keepAliveMsecs: 30000,
        maxSockets: 10,
        timeout: 15000 // Shorter timeout for faster failure detection
    }
};

class GitHubCodespacesDiagnosticFix {
    constructor() {
        this.diagnosticResults = new Map();
        this.connectionPool = new Map();
        this.bypassServer = null;
        
        this.initializeFix();
    }

    async initializeFix() {
        console.log('🔧 Initializing GitHub Codespaces Diagnostic Fix...');
        
        try {
            // Step 1: Analyze the current timeout issue
            await this.analyzeTimeoutIssue();
            
            // Step 2: Implement bypass mechanisms
            await this.setupDiagnosticBypass();
            
            // Step 3: Create local diagnostic server
            await this.startLocalDiagnosticServer();
            
            // Step 4: Test alternative connection methods
            await this.testAlternativeConnections();
            
            console.log('✅ Diagnostic fix initialized successfully');
            
        } catch (error) {
            console.error('❌ Diagnostic fix initialization failed:', error.message);
            throw error;
        }
    }

    async analyzeTimeoutIssue() {
        console.log('🔍 Analyzing 504 Gateway Timeout issue...');
        
        const analysis = {
            timestamp: new Date().toISOString(),
            codespaces_url: DIAGNOSTIC_CONFIG.CODESPACES_URL,
            endpoint: DIAGNOSTIC_CONFIG.DIAGNOSTIC_ENDPOINT,
            timeout_duration: DIAGNOSTIC_CONFIG.TIMEOUT_DURATION,
            likely_causes: [
                'Upstream server overload on GitHub Codespaces',
                'Cold start latency in containerized environment', 
                'Network congestion between gateway and container',
                'Resource exhaustion in the codespace instance',
                'MCP server not responding within timeout window'
            ],
            recommended_fixes: [
                'Implement connection pooling',
                'Add circuit breaker pattern',
                'Create local diagnostic bypass',
                'Use shorter timeout with faster retries',
                'Implement health check endpoints'
            ]
        };
        
        console.log('📊 Timeout Analysis:', JSON.stringify(analysis, null, 2));
        
        // Test basic connectivity
        const connectivityTest = await this.testBasicConnectivity();
        analysis.connectivity_test = connectivityTest;
        
        await this.saveDiagnosticReport('timeout-analysis', analysis);
        
        return analysis;
    }

    async testBasicConnectivity() {
        const results = {
            codespaces_ping: false,
            github_api: false,
            external_http: false,
            dns_resolution: false
        };
        
        // Test 1: Codespaces endpoint (expected to fail)
        try {
            const response = await axios.get(`https://${DIAGNOSTIC_CONFIG.CODESPACES_URL}/health`, {
                timeout: 5000,
                validateStatus: () => true // Accept any status code
            });
            results.codespaces_ping = response.status < 500;
            console.log(`🏓 Codespaces ping: ${response.status}`);
        } catch (error) {
            console.log(`🏓 Codespaces ping failed: ${error.code || error.message}`);
        }
        
        // Test 2: GitHub API
        try {
            const response = await axios.get('https://api.github.com/zen', { timeout: 5000 });
            results.github_api = response.status === 200;
            console.log(`✅ GitHub API: ${response.status}`);
        } catch (error) {
            console.log(`❌ GitHub API failed: ${error.message}`);
        }
        
        // Test 3: External HTTP
        try {
            const response = await axios.get('https://httpbin.org/ip', { timeout: 5000 });
            results.external_http = response.status === 200;
            console.log(`🌐 External HTTP: ${response.status}`);
        } catch (error) {
            console.log(`❌ External HTTP failed: ${error.message}`);
        }
        
        // Test 4: DNS resolution
        try {
            const { lookup } = await import('dns/promises');
            await lookup(DIAGNOSTIC_CONFIG.CODESPACES_URL);
            results.dns_resolution = true;
            console.log('🔍 DNS resolution: Success');
        } catch (error) {
            console.log(`🔍 DNS resolution failed: ${error.message}`);
        }
        
        return results;
    }

    async setupDiagnosticBypass() {
        console.log('🚀 Setting up diagnostic bypass mechanisms...');
        
        // Create bypass configuration
        const bypassConfig = {
            mode: 'local_server',
            fallback_endpoints: DIAGNOSTIC_CONFIG.FALLBACK_ENDPOINTS,
            circuit_breaker: {
                failure_threshold: 3,
                reset_timeout: 30000,
                monitoring_period: 60000
            },
            connection_pooling: {
                max_connections: 10,
                connection_timeout: 15000,
                idle_timeout: 30000
            }
        };
        
        // Implement circuit breaker for Codespaces endpoint
        this.circuitBreaker = new CircuitBreaker({
            threshold: bypassConfig.circuit_breaker.failure_threshold,
            resetTimeout: bypassConfig.circuit_breaker.reset_timeout
        });
        
        console.log('✅ Bypass mechanisms configured');
        return bypassConfig;
    }

    async startLocalDiagnosticServer() {
        return new Promise(async (resolve, reject) => {
            const express = (await import('express')).default;
            const app = express();
            
            app.use(express.json());
            app.use((req, res, next) => {
                res.header('Access-Control-Allow-Origin', '*');
                res.header('Access-Control-Allow-Headers', 'Content-Type');
                res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
                next();
            });
            
            // Health check endpoint
            app.get('/health', (req, res) => {
                res.json({
                    status: 'healthy',
                    timestamp: new Date().toISOString(),
                    uptime: process.uptime(),
                    memory: process.memoryUsage()
                });
            });
            
            // Diagnostic endpoint (bypass)
            app.post('/diagnostic', async (req, res) => {
                try {
                    console.log('🔧 Handling bypassed diagnostic request...');
                    
                    const diagnosticResult = await this.performLocalDiagnostic(req.body);
                    
                    // Set streaming headers as expected
                    res.setHeader('Content-Type', 'application/x-json-stream');
                    res.setHeader('Transfer-Encoding', 'chunked');
                    
                    // Send diagnostic data in chunks (simulate streaming)
                    const chunks = this.chunkDiagnosticData(diagnosticResult);
                    
                    for (const chunk of chunks) {
                        res.write(JSON.stringify(chunk) + '\n');
                        await new Promise(resolve => setTimeout(resolve, 100)); // Small delay for streaming effect
                    }
                    
                    res.end();
                    
                } catch (error) {
                    console.error('❌ Local diagnostic failed:', error.message);
                    res.status(500).json({ error: error.message });
                }
            });
            
            // MCP integration endpoint
            app.post('/mcp/connect', async (req, res) => {
                try {
                    const mcpConnection = await this.establishMCPConnection(req.body);
                    res.json(mcpConnection);
                } catch (error) {
                    res.status(500).json({ error: error.message });
                }
            });
            
            // Start server
            this.bypassServer = app.listen(DIAGNOSTIC_CONFIG.LOCAL_DIAGNOSTIC_PORT, () => {
                console.log(`✅ Local diagnostic server running on port ${DIAGNOSTIC_CONFIG.LOCAL_DIAGNOSTIC_PORT}`);
                resolve();
            });
            
            this.bypassServer.on('error', reject);
        });
    }

    async performLocalDiagnostic(requestData) {
        console.log('🔍 Performing local diagnostic...');
        
        const diagnostic = {
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            request_data: requestData,
            system_info: {
                node_version: process.version,
                platform: process.platform,
                arch: process.arch,
                memory: process.memoryUsage(),
                uptime: process.uptime()
            },
            network_tests: {},
            mcp_status: {},
            recommendations: []
        };
        
        // Perform network tests
        diagnostic.network_tests = await this.performNetworkTests();
        
        // Check MCP server status
        diagnostic.mcp_status = await this.checkMCPStatus();
        
        // Generate recommendations
        diagnostic.recommendations = this.generateRecommendations(diagnostic);
        
        return diagnostic;
    }

    async performNetworkTests() {
        const tests = {
            github_api: { status: 'unknown', latency: 0, error: null },
            external_http: { status: 'unknown', latency: 0, error: null },
            dns_resolution: { status: 'unknown', latency: 0, error: null },
            port_connectivity: { status: 'unknown', ports: [], error: null }
        };
        
        // Test GitHub API
        try {
            const start = Date.now();
            const response = await axios.get('https://api.github.com/zen', { timeout: 10000 });
            tests.github_api = {
                status: response.status === 200 ? 'success' : 'error',
                latency: Date.now() - start,
                error: null
            };
        } catch (error) {
            tests.github_api = {
                status: 'error',
                latency: 0,
                error: error.message
            };
        }
        
        // Test external HTTP
        try {
            const start = Date.now();
            const response = await axios.get('https://httpbin.org/get', { timeout: 10000 });
            tests.external_http = {
                status: response.status === 200 ? 'success' : 'error',
                latency: Date.now() - start,
                error: null
            };
        } catch (error) {
            tests.external_http = {
                status: 'error',
                latency: 0,
                error: error.message
            };
        }
        
        // Test DNS resolution
        try {
            const start = Date.now();
            const { lookup } = await import('dns/promises');
            await lookup('github.com');
            tests.dns_resolution = {
                status: 'success',
                latency: Date.now() - start,
                error: null
            };
        } catch (error) {
            tests.dns_resolution = {
                status: 'error',
                latency: 0,
                error: error.message
            };
        }
        
        return tests;
    }

    async checkMCPStatus() {
        const status = {
            local_server: 'unknown',
            connections: [],
            last_error: null
        };
        
        try {
            // Check if local MCP server is running
            const response = await axios.get('http://localhost:3001/health', { timeout: 5000 });
            status.local_server = response.status === 200 ? 'running' : 'error';
        } catch (error) {
            status.local_server = 'not_running';
            status.last_error = error.message;
        }
        
        return status;
    }

    chunkDiagnosticData(diagnosticResult) {
        // Split diagnostic data into chunks for streaming
        const chunks = [
            { type: 'start', timestamp: new Date().toISOString() },
            { type: 'system_info', data: diagnosticResult.system_info },
            { type: 'network_tests', data: diagnosticResult.network_tests },
            { type: 'mcp_status', data: diagnosticResult.mcp_status },
            { type: 'recommendations', data: diagnosticResult.recommendations },
            { type: 'complete', timestamp: new Date().toISOString() }
        ];
        
        return chunks;
    }

    generateRecommendations(diagnostic) {
        const recommendations = [];
        
        if (diagnostic.network_tests.github_api.status === 'error') {
            recommendations.push({
                issue: 'GitHub API connectivity failed',
                solution: 'Use local MCP server bypass',
                priority: 'high'
            });
        }
        
        if (diagnostic.mcp_status.local_server === 'not_running') {
            recommendations.push({
                issue: 'Local MCP server not running',
                solution: 'Start MCP server: node mcp-server.js',
                priority: 'critical'
            });
        }
        
        if (diagnostic.network_tests.external_http.latency > 5000) {
            recommendations.push({
                issue: 'High network latency detected',
                solution: 'Implement connection pooling and shorter timeouts',
                priority: 'medium'
            });
        }
        
        // Always recommend bypass for Codespaces issues
        recommendations.push({
            issue: 'Codespaces gateway timeout (504)',
            solution: 'Use local diagnostic server bypass',
            priority: 'high',
            bypass_url: `http://localhost:${DIAGNOSTIC_CONFIG.LOCAL_DIAGNOSTIC_PORT}/diagnostic`
        });
        
        return recommendations;
    }

    async testAlternativeConnections() {
        console.log('🔗 Testing alternative connection methods...');
        
        const alternatives = [
            { name: 'Local MCP Server', url: 'http://localhost:3001/health' },
            { name: 'GitHub API Direct', url: 'https://api.github.com/zen' },
            { name: 'Local Diagnostic Server', url: `http://localhost:${DIAGNOSTIC_CONFIG.LOCAL_DIAGNOSTIC_PORT}/health` }
        ];
        
        const results = {};
        
        for (const alternative of alternatives) {
            try {
                const start = Date.now();
                const response = await axios.get(alternative.url, { timeout: 10000 });
                results[alternative.name] = {
                    status: 'success',
                    latency: Date.now() - start,
                    http_status: response.status
                };
                console.log(`✅ ${alternative.name}: ${response.status} (${Date.now() - start}ms)`);
            } catch (error) {
                results[alternative.name] = {
                    status: 'error',
                    error: error.message
                };
                console.log(`❌ ${alternative.name}: ${error.message}`);
            }
        }
        
        return results;
    }

    async establishMCPConnection(config) {
        console.log('🔗 Establishing MCP connection via bypass...');
        
        try {
            // Try local MCP server first
            const localMCP = await axios.post('http://localhost:3001/mcp/initialize', {
                clientInfo: {
                    name: 'Sina Empire Bypass',
                    version: '1.0.0'
                },
                capabilities: {}
            }, { timeout: 10000 });
            
            if (localMCP.status === 200) {
                console.log('✅ Local MCP connection established');
                return {
                    status: 'connected',
                    method: 'local_mcp_server',
                    endpoint: 'http://localhost:3001/mcp',
                    capabilities: localMCP.data.capabilities
                };
            }
            
        } catch (error) {
            console.log(`❌ Local MCP connection failed: ${error.message}`);
        }
        
        // Fallback to bypass mode
        return {
            status: 'bypassed',
            method: 'diagnostic_bypass',
            endpoint: `http://localhost:${DIAGNOSTIC_CONFIG.LOCAL_DIAGNOSTIC_PORT}`,
            message: 'Using local diagnostic server as MCP bypass'
        };
    }

    async saveDiagnosticReport(reportType, data) {
        try {
            await fs.mkdir('./diagnostic-reports', { recursive: true });
            const filename = `./diagnostic-reports/${reportType}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
            await fs.writeFile(filename, JSON.stringify(data, null, 2));
            console.log(`📄 Diagnostic report saved: ${filename}`);
        } catch (error) {
            console.error('❌ Failed to save diagnostic report:', error.message);
        }
    }

    // =============================================
    // PUBLIC API METHODS
    // =============================================

    async runDiagnosticTest() {
        console.log('🔧 Running comprehensive diagnostic test...');
        
        const testResult = {
            timestamp: new Date().toISOString(),
            original_issue: {
                url: `https://${DIAGNOSTIC_CONFIG.CODESPACES_URL}${DIAGNOSTIC_CONFIG.DIAGNOSTIC_ENDPOINT}`,
                status: '504 Gateway Timeout',
                duration: '60 seconds'
            },
            bypass_test: null,
            alternative_connections: null,
            recommendations: []
        };
        
        // Test bypass endpoint
        try {
            const start = Date.now();
            const response = await axios.post(`http://localhost:${DIAGNOSTIC_CONFIG.LOCAL_DIAGNOSTIC_PORT}/diagnostic`, {
                test: true,
                cors: true,
                'content-type': 'application/x-json-stream'
            }, {
                headers: {
                    'Content-Type': 'application/x-json-stream'
                },
                timeout: 15000
            });
            
            testResult.bypass_test = {
                status: 'success',
                duration: Date.now() - start,
                http_status: response.status
            };
            
        } catch (error) {
            testResult.bypass_test = {
                status: 'error',
                error: error.message
            };
        }
        
        // Test alternative connections
        testResult.alternative_connections = await this.testAlternativeConnections();
        
        // Generate recommendations
        if (testResult.bypass_test.status === 'success') {
            testResult.recommendations.push({
                action: 'Use local diagnostic server',
                command: `curl -X POST http://localhost:${DIAGNOSTIC_CONFIG.LOCAL_DIAGNOSTIC_PORT}/diagnostic`,
                priority: 'immediate'
            });
        }
        
        testResult.recommendations.push({
            action: 'Start local MCP server',
            command: 'node mcp-server.js',
            priority: 'immediate'
        });
        
        testResult.recommendations.push({
            action: 'Use bypass connector',
            command: 'node mcp-github-connector.js',
            priority: 'immediate'
        });
        
        await this.saveDiagnosticReport('comprehensive-test', testResult);
        
        return testResult;
    }

    async getBypassInstructions() {
        return {
            problem: 'GitHub Codespaces 504 Gateway Timeout on /diagnostic endpoint',
            solution: 'Local diagnostic server bypass',
            instructions: [
                {
                    step: 1,
                    action: 'Start local diagnostic server',
                    command: 'node codespaces-diagnostic-fix.js',
                    expected: 'Server running on port 3002'
                },
                {
                    step: 2,
                    action: 'Test bypass endpoint',
                    command: `curl -X POST http://localhost:${DIAGNOSTIC_CONFIG.LOCAL_DIAGNOSTIC_PORT}/diagnostic -H "Content-Type: application/x-json-stream"`,
                    expected: 'Streaming JSON response'
                },
                {
                    step: 3,
                    action: 'Start your MCP server',
                    command: 'node mcp-server.js',
                    expected: 'MCP Server running on port 3001'
                },
                {
                    step: 4,
                    action: 'Connect via bypass',
                    command: 'Use localhost endpoints instead of codespaces URLs',
                    expected: 'Stable connections without timeouts'
                }
            ],
            bypass_endpoints: {
                diagnostic: `http://localhost:${DIAGNOSTIC_CONFIG.LOCAL_DIAGNOSTIC_PORT}/diagnostic`,
                health: `http://localhost:${DIAGNOSTIC_CONFIG.LOCAL_DIAGNOSTIC_PORT}/health`,
                mcp_connect: `http://localhost:${DIAGNOSTIC_CONFIG.LOCAL_DIAGNOSTIC_PORT}/mcp/connect`
            }
        };
    }

    // =============================================
    // CLI INTERFACE
    // =============================================

    async runCommand(command, args = []) {
        switch (command) {
            case 'test':
                return await this.runDiagnosticTest();
                
            case 'bypass':
                return await this.getBypassInstructions();
                
            case 'analyze':
                return await this.analyzeTimeoutIssue();
                
            case 'connect':
                return await this.establishMCPConnection(args[0] || {});
                
            case 'alternatives':
                return await this.testAlternativeConnections();
                
            default:
                console.log('Available commands:');
                console.log('  test - Run comprehensive diagnostic test');
                console.log('  bypass - Get bypass instructions');
                console.log('  analyze - Analyze timeout issue');
                console.log('  connect - Establish MCP connection');
                console.log('  alternatives - Test alternative connections');
        }
    }

    async shutdown() {
        if (this.bypassServer) {
            this.bypassServer.close();
            console.log('✅ Bypass server shut down');
        }
    }
}

// Circuit Breaker implementation
class CircuitBreaker {
    constructor({ threshold = 5, resetTimeout = 60000 }) {
        this.threshold = threshold;
        this.resetTimeout = resetTimeout;
        this.failureCount = 0;
        this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
        this.nextAttempt = Date.now();
    }
    
    async call(fn) {
        if (this.state === 'OPEN') {
            if (Date.now() < this.nextAttempt) {
                throw new Error('Circuit breaker is OPEN');
            }
            this.state = 'HALF_OPEN';
        }
        
        try {
            const result = await fn();
            this.onSuccess();
            return result;
        } catch (error) {
            this.onFailure();
            throw error;
        }
    }
    
    onSuccess() {
        this.failureCount = 0;
        this.state = 'CLOSED';
    }
    
    onFailure() {
        this.failureCount++;
        if (this.failureCount >= this.threshold) {
            this.state = 'OPEN';
            this.nextAttempt = Date.now() + this.resetTimeout;
        }
    }
}

// =============================================
// CLI EXECUTION
// =============================================

if (import.meta.url === `file://${process.argv[1]}`) {
    const diagnosticFix = new GitHubCodespacesDiagnosticFix();
    const [,, command, ...args] = process.argv;
    
    if (command) {
        diagnosticFix.runCommand(command, args).then(result => {
            if (result) console.log(JSON.stringify(result, null, 2));
        }).catch(console.error);
    } else {
        diagnosticFix.getBypassInstructions().then(instructions => {
            console.log('🔧 GITHUB CODESPACES 504 GATEWAY TIMEOUT - BYPASS SOLUTION');
            console.log('==============================================================');
            console.log(JSON.stringify(instructions, null, 2));
        }).catch(console.error);
    }
    
    process.on('SIGINT', async () => {
        await diagnosticFix.shutdown();
        process.exit(0);
    });
}

export { GitHubCodespacesDiagnosticFix };