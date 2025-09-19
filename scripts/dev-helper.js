#!/usr/bin/env node

/**
 * Empire MCP System - Development Helper Script
 * Provides comprehensive development utilities for the MCP ecosystem
 * Author: SINA Empire
 */

const axios = require('axios');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class MCPDevHelper {
  constructor() {
    this.baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    this.healthEndpoint = `${this.baseUrl}/health`;
    this.projectRoot = path.resolve(__dirname, '..');
    this.logFile = path.join(this.projectRoot, 'mcp-dev-helper.log');
    this.maxHealthRetries = 5;
    this.healthRetryDelay = 2000; // 2 seconds
    this.restartAttempts = 0;
    this.maxRestartAttempts = 3;
  }

  /**
     * Log message with timestamp and color
     */
  log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const colors = {
      INFO: '\x1b[34m',    // Blue
      SUCCESS: '\x1b[32m', // Green
      WARNING: '\x1b[33m', // Yellow
      ERROR: '\x1b[31m',   // Red
      RESET: '\x1b[0m'     // Reset
    };

    const color = colors[level] || colors.RESET;
    const logEntry = `${timestamp} [${level}] ${message}`;
        
    // Console output with color
    console.log(`${color}${logEntry}${colors.RESET}`);
        
    // File output without color
    const fileEntry = data ? `${logEntry}\nData: ${JSON.stringify(data, null, 2)}\n` : `${logEntry}\n`;
    fs.appendFileSync(this.logFile, fileEntry);
  }

  /**
     * Execute shell command and return result
     */
  async executeCommand(command, options = {}) {
    return new Promise((resolve, reject) => {
      const child = spawn('sh', ['-c', command], {
        cwd: this.projectRoot,
        stdio: 'pipe',
        ...options
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        resolve({
          code,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          success: code === 0
        });
      });

      child.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
     * Check MCP server health
     */
  async checkHealth(retries = 1) {
    this.log('INFO', `Checking MCP health at ${this.healthEndpoint}...`);
        
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await axios.get(this.healthEndpoint, {
          timeout: 5000,
          validateStatus: (status) => status < 500
        });

        if (response.status === 200) {
          this.log('SUCCESS', 'Health check passed!', response.data);
          return {
            healthy: true,
            status: response.status,
            data: response.data,
            attempt
          };
        } else {
          this.log('WARNING', `Health check returned status ${response.status}`, response.data);
        }
      } catch (error) {
        this.log('WARNING', `Health check attempt ${attempt}/${retries} failed: ${error.message}`);
                
        if (attempt < retries) {
          this.log('INFO', `Retrying in ${this.healthRetryDelay/1000} seconds...`);
          await new Promise(resolve => setTimeout(resolve, this.healthRetryDelay));
        }
      }
    }

    this.log('ERROR', 'Health check failed after all attempts');
    return {
      healthy: false,
      attempt: retries
    };
  }

  /**
     * Run the MCP test suite
     */
  async runTests() {
    this.log('INFO', 'Running MCP test suite...');
        
    try {
      const result = await this.executeCommand('npm test');
            
      if (result.success) {
        this.log('SUCCESS', 'Test suite completed successfully');
        this.log('INFO', 'Test output:', result.stdout);
        return { success: true, output: result.stdout };
      } else {
        this.log('ERROR', 'Test suite failed');
        this.log('ERROR', 'Test errors:', result.stderr);
        return { success: false, output: result.stderr };
      }
    } catch (error) {
      this.log('ERROR', `Test execution error: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
     * Check critical endpoints
     */
  async checkCriticalEndpoints() {
    this.log('INFO', 'Checking critical MCP endpoints...');
        
    const criticalEndpoints = [
      { path: '/health', method: 'GET', name: 'Health Check' },
      { path: '/mcp/status', method: 'GET', name: 'System Status' },
      { path: '/mcp/workflows', method: 'GET', name: 'Workflows' }
    ];

    const results = [];
    let criticalFailures = 0;

    for (const endpoint of criticalEndpoints) {
      try {
        const url = `${this.baseUrl}${endpoint.path}`;
        const response = await axios({
          method: endpoint.method,
          url,
          timeout: 5000,
          validateStatus: (status) => status < 500
        });

        if (response.status === 200) {
          this.log('SUCCESS', `✅ ${endpoint.name}: OK (${response.status})`);
          results.push({ ...endpoint, status: 'OK', code: response.status });
        } else {
          this.log('WARNING', `⚠️  ${endpoint.name}: ${response.status}`);
          results.push({ ...endpoint, status: 'WARNING', code: response.status });
          criticalFailures++;
        }
      } catch (error) {
        this.log('ERROR', `❌ ${endpoint.name}: Failed - ${error.message}`);
        results.push({ ...endpoint, status: 'FAILED', error: error.message });
        criticalFailures++;
      }
    }

    const summary = {
      total: criticalEndpoints.length,
      passed: results.filter(r => r.status === 'OK').length,
      failed: criticalFailures,
      results
    };

    this.log('INFO', 'Critical endpoints check summary:', summary);
        
    return {
      hasCriticalFailures: criticalFailures > 0,
      summary
    };
  }

  /**
     * Start MCP server
     */
  async startServer() {
    this.log('INFO', 'Starting MCP server...');
        
    try {
      // Kill any existing server processes
      await this.executeCommand('pkill -f "node.*server.js" || true');
      await this.executeCommand('pkill -f "npm.*start" || true');
            
      // Wait a moment for cleanup
      await new Promise(resolve => setTimeout(resolve, 2000));
            
      // Start the server in background
      const serverProcess = spawn('npm', ['start'], {
        cwd: this.projectRoot,
        detached: true,
        stdio: 'ignore'
      });
            
      serverProcess.unref();
            
      this.log('INFO', `Server start initiated with PID: ${serverProcess.pid}`);
            
      // Wait for server to initialize
      await new Promise(resolve => setTimeout(resolve, 5000));
            
      // Check if server started successfully
      const health = await this.checkHealth(3);
            
      if (health.healthy) {
        this.log('SUCCESS', 'MCP server started successfully');
        return { success: true };
      } else {
        this.log('ERROR', 'Server started but health check failed');
        return { success: false, reason: 'Health check failed' };
      }
            
    } catch (error) {
      this.log('ERROR', `Failed to start server: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
     * Restart MCP server if critical endpoints fail
     */
  async autoRestartIfNeeded() {
    if (this.restartAttempts >= this.maxRestartAttempts) {
      this.log('ERROR', `Maximum restart attempts (${this.maxRestartAttempts}) reached. Manual intervention required.`);
      return { restarted: false, reason: 'Max attempts reached' };
    }

    this.log('WARNING', 'Critical failures detected. Attempting to restart MCP server...');
    this.restartAttempts++;
        
    const restartResult = await this.startServer();
        
    if (restartResult.success) {
      this.log('SUCCESS', `Server restarted successfully (attempt ${this.restartAttempts}/${this.maxRestartAttempts})`);
            
      // Verify restart worked by checking endpoints again
      const endpointCheck = await this.checkCriticalEndpoints();
            
      if (!endpointCheck.hasCriticalFailures) {
        this.log('SUCCESS', 'Restart successful - all critical endpoints are working');
        this.restartAttempts = 0; // Reset counter on success
        return { restarted: true, success: true };
      } else {
        this.log('WARNING', 'Restart completed but critical failures still exist');
        return { restarted: true, success: false };
      }
    } else {
      this.log('ERROR', `Server restart failed: ${restartResult.reason || restartResult.error}`);
      return { restarted: false, reason: restartResult.reason || restartResult.error };
    }
  }

  /**
     * Generate comprehensive status report
     */
  async generateStatusReport() {
    this.log('INFO', '=== MCP Development Status Report ===');
        
    const report = {
      timestamp: new Date().toISOString(),
      health: null,
      endpoints: null,
      tests: null,
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        projectRoot: this.projectRoot,
        baseUrl: this.baseUrl
      }
    };

    // Health check
    report.health = await this.checkHealth(this.maxHealthRetries);
        
    // Critical endpoints check
    const endpointCheck = await this.checkCriticalEndpoints();
    report.endpoints = endpointCheck.summary;
        
    // Run tests if server is healthy
    if (report.health.healthy) {
      report.tests = await this.runTests();
    } else {
      this.log('WARNING', 'Skipping tests due to server health issues');
      report.tests = { skipped: true, reason: 'Server unhealthy' };
    }

    this.log('INFO', '=== Status Report Complete ===', report);
        
    return report;
  }

  /**
     * Monitor and maintain MCP system
     */
  async monitor() {
    this.log('INFO', '🔍 Starting MCP system monitoring...');
        
    const report = await this.generateStatusReport();
        
    // Check if restart is needed
    if (!report.health.healthy || report.endpoints.failed > 0) {
      this.log('WARNING', 'System issues detected. Attempting automatic resolution...');
            
      const restartResult = await this.autoRestartIfNeeded();
            
      if (restartResult.restarted && restartResult.success) {
        // Re-run status report after successful restart
        this.log('INFO', 'Re-checking system status after restart...');
        const postRestartReport = await this.generateStatusReport();
                
        return {
          initialReport: report,
          restarted: true,
          finalReport: postRestartReport
        };
      } else if (restartResult.restarted && !restartResult.success) {
        this.log('ERROR', 'Restart attempted but issues persist');
        return {
          initialReport: report,
          restarted: true,
          restartSuccess: false
        };
      } else {
        this.log('ERROR', 'Could not restart system');
        return {
          initialReport: report,
          restarted: false,
          reason: restartResult.reason
        };
      }
    } else {
      this.log('SUCCESS', '✅ System is healthy - no action needed');
      return {
        initialReport: report,
        healthy: true
      };
    }
  }

  /**
     * Show usage help
     */
  showHelp() {
    console.log(`
Empire MCP System - Development Helper

Usage: node dev-helper.js [command] [options]

Commands:
  health              Check MCP server health
  test               Run the MCP test suite  
  endpoints          Check critical endpoints
  restart            Restart MCP server
  monitor            Monitor and auto-fix issues
  report             Generate status report
  help               Show this help

Options:
  --retries <n>      Number of health check retries (default: 5)
  --url <url>        Base URL for MCP server (default: http://localhost:3000)

Examples:
  node dev-helper.js health --retries 3
  node dev-helper.js monitor
  node dev-helper.js test
  node dev-helper.js endpoints
        `);
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'monitor';
    
  // Parse options
  const options = {};
  for (let i = 1; i < args.length; i += 2) {
    if (args[i]?.startsWith('--')) {
      const key = args[i].substring(2);
      const value = args[i + 1];
      options[key] = value;
    }
  }

  const helper = new MCPDevHelper();
    
  // Override defaults with options
  if (options.url) helper.baseUrl = options.url;
  if (options.retries) helper.maxHealthRetries = parseInt(options.retries);

  try {
    switch (command) {
    case 'health': {
      const health = await helper.checkHealth(helper.maxHealthRetries);
      process.exit(health.healthy ? 0 : 1);
      break;
    }
    case 'test': {
      const testResult = await helper.runTests();
      process.exit(testResult.success ? 0 : 1);
      break;
    }
    case 'endpoints': {
      const endpointCheck = await helper.checkCriticalEndpoints();
      process.exit(endpointCheck.hasCriticalFailures ? 1 : 0);
      break;
    }
    case 'restart': {
      const restartResult = await helper.startServer();
      process.exit(restartResult.success ? 0 : 1);
      break;
    }
    case 'monitor': {
      const monitorResult = await helper.monitor();
      const success = monitorResult.healthy || 
                        (monitorResult.restarted && monitorResult.restartSuccess !== false);
      process.exit(success ? 0 : 1);
      break;
    }
    case 'report': {
      await helper.generateStatusReport();
      process.exit(0);
      break;
    }
    case 'help':
    default:
      helper.showHelp();
      process.exit(0);
      break;
    }
  } catch (error) {
    helper.log('ERROR', `Fatal error: ${error.message}`);
    process.exit(1);
  }
}

// Export for use as module
module.exports = MCPDevHelper;

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}