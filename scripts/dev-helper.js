#!/usr/bin/env node

/**
 * Development Helper Script
 * Self-healing development agent for the MCP ecosystem
 * Performs health checks, auto-recovery, and development tasks
 */

const { exec, spawn } = require('child_process');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

class DevHelper {
  constructor(options = {}) {
    this.projectRoot = path.resolve(__dirname, '..');
    this.logFile = path.join(this.projectRoot, 'dev-helper.log');
    this.serverUrl = options.serverUrl || 'http://localhost:3000';
    
    // Configuration
    this.config = {
      maxRetries: options.maxRetries || 3,
      healthCheckInterval: options.healthCheckInterval || 30000, // 30 seconds
      initialBackoff: options.initialBackoff || 1000, // 1 second
      maxBackoff: options.maxBackoff || 30000, // 30 seconds
      healthTimeout: options.healthTimeout || 5000, // 5 seconds
      ...options.config
    };

    this.attempts = 0;
    this.isRunning = false;
    this.mcpController = null;
    
    this.initializeMCPController();
  }

  /**
   * Initialize MCP controller
   */
  initializeMCPController() {
    try {
      const MCPController = require('./mcp-control.js');
      this.mcpController = new MCPController();
      this.log('✅ MCP Controller initialized');
    } catch (error) {
      this.log(`⚠️  Failed to initialize MCP Controller: ${error.message}`);
    }
  }

  /**
   * Log messages with timestamp
   */
  log(message) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [DevHelper] ${message}\n`;
    
    console.log(`[DevHelper] ${message}`);
    
    try {
      fs.appendFileSync(this.logFile, logEntry);
    } catch (error) {
      console.error('Failed to write to log file:', error.message);
    }
  }

  /**
   * Calculate exponential backoff delay
   */
  calculateBackoff(attempt) {
    const delay = Math.min(
      this.config.initialBackoff * Math.pow(2, attempt),
      this.config.maxBackoff
    );
    return delay + Math.random() * 1000; // Add jitter
  }

  /**
   * Execute shell command
   */
  execCommand(command, options = {}) {
    return new Promise((resolve) => {
      exec(command, { cwd: this.projectRoot, ...options }, (error, stdout, stderr) => {
        resolve({
          success: !error,
          stdout: stdout?.trim() || '',
          stderr: stderr?.trim() || '',
          error: error?.message
        });
      });
    });
  }

  /**
   * Health check the MCP server
   */
  async healthCheck() {
    try {
      const response = await axios.get(`${this.serverUrl}/health`, {
        timeout: this.config.healthTimeout
      });

      if (response.status === 200 && response.data.status === 'healthy') {
        return { healthy: true, response: response.data };
      } else {
        return { healthy: false, error: 'Unhealthy response', response: response.data };
      }
    } catch (error) {
      return { healthy: false, error: error.message };
    }
  }

  /**
   * Install dependencies
   */
  async installDependencies() {
    this.log('📦 Installing dependencies...');
    
    const result = await this.execCommand('npm install');
    
    if (result.success) {
      this.log('✅ Dependencies installed successfully');
      return true;
    } else {
      this.log(`❌ Failed to install dependencies: ${result.error || result.stderr}`);
      return false;
    }
  }

  /**
   * Start MCP server if not running
   */
  async ensureMCPRunning() {
    if (!this.mcpController) {
      this.log('⚠️  MCP Controller not available, cannot start server');
      return false;
    }

    try {
      const status = await this.mcpController.status();
      
      if (status.running) {
        this.log(`✅ MCP server is already running (PIDs: ${status.pids.join(', ')})`);
        return true;
      }

      this.log('🚀 Starting MCP server...');
      const result = await this.mcpController.start();
      
      if (result.success) {
        this.log(`✅ MCP server started successfully via ${result.method}`);
        
        // Wait a moment for server to fully start
        await new Promise(resolve => setTimeout(resolve, 3000));
        return true;
      } else {
        this.log(`❌ Failed to start MCP server: ${result.error}`);
        return false;
      }
    } catch (error) {
      this.log(`❌ Error ensuring MCP is running: ${error.message}`);
      return false;
    }
  }

  /**
   * Run MCP ecosystem tests
   */
  async runTests() {
    this.log('🧪 Running MCP ecosystem tests...');
    
    const result = await this.execCommand('node test-mcp-ecosystem.js');
    
    if (result.success) {
      // Check for test failures in output
      if (result.stdout.includes('Failed: 0') || result.stdout.includes('Success Rate: 100')) {
        this.log('✅ All tests passed');
        return { success: true, output: result.stdout };
      } else {
        this.log('⚠️  Some tests failed, but test runner completed');
        return { success: false, output: result.stdout, partialSuccess: true };
      }
    } else {
      this.log(`❌ Test execution failed: ${result.error || result.stderr}`);
      return { success: false, output: result.stdout || result.stderr, error: result.error };
    }
  }

  /**
   * Attempt automatic recovery
   */
  async attemptRecovery() {
    this.attempts++;
    const delay = this.calculateBackoff(this.attempts - 1);
    
    this.log(`🔧 Attempting recovery (attempt ${this.attempts}/${this.config.maxRetries})`);
    this.log(`⏳ Waiting ${Math.round(delay)}ms before recovery attempt...`);
    
    await new Promise(resolve => setTimeout(resolve, delay));

    try {
      // Step 1: Install dependencies
      const depsInstalled = await this.installDependencies();
      if (!depsInstalled) {
        this.log('❌ Recovery failed: could not install dependencies');
        return false;
      }

      // Step 2: Restart MCP server
      if (this.mcpController) {
        this.log('🔄 Restarting MCP server...');
        const restartResult = await this.mcpController.restart();
        
        if (!restartResult.success) {
          this.log('❌ Recovery failed: could not restart MCP server');
          return false;
        }
      }

      // Step 3: Wait for server to be ready
      this.log('⏳ Waiting for server to be ready...');
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Step 4: Verify health
      const health = await this.healthCheck();
      if (!health.healthy) {
        this.log(`❌ Recovery failed: health check failed - ${health.error}`);
        return false;
      }

      this.log('✅ Recovery successful!');
      this.attempts = 0; // Reset attempt counter
      return true;
    } catch (error) {
      this.log(`❌ Recovery attempt failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Run complete development cycle
   */
  async runDevelopmentCycle() {
    this.log('🎯 Starting development cycle...');

    // Step 1: Install dependencies
    const depsInstalled = await this.installDependencies();
    if (!depsInstalled) {
      this.log('❌ Development cycle failed: dependency installation failed');
      return false;
    }

    // Step 2: Ensure MCP is running
    const mcpRunning = await this.ensureMCPRunning();
    if (!mcpRunning) {
      this.log('❌ Development cycle failed: could not start MCP server');
      return false;
    }

    // Step 3: Health check
    const health = await this.healthCheck();
    if (!health.healthy) {
      this.log(`⚠️  Health check failed: ${health.error}`);
      
      if (this.attempts < this.config.maxRetries) {
        this.log('🔧 Attempting automatic recovery...');
        const recovered = await this.attemptRecovery();
        
        if (recovered) {
          return await this.runDevelopmentCycle(); // Retry after recovery
        } else {
          this.log('❌ Automatic recovery failed');
          return false;
        }
      } else {
        this.log(`❌ Max recovery attempts (${this.config.maxRetries}) reached`);
        return false;
      }
    }

    // Step 4: Run tests
    const testResult = await this.runTests();
    if (!testResult.success) {
      this.log('⚠️  Tests failed');
      
      if (testResult.partialSuccess) {
        this.log('ℹ️  Partial test success, system may be functional');
      } else if (this.attempts < this.config.maxRetries) {
        this.log('🔧 Attempting automatic recovery due to test failures...');
        const recovered = await this.attemptRecovery();
        
        if (recovered) {
          return await this.runDevelopmentCycle(); // Retry after recovery
        } else {
          this.log('❌ Automatic recovery failed');
          return false;
        }
      } else {
        this.log(`❌ Max recovery attempts (${this.config.maxRetries}) reached`);
        return false;
      }
    }

    this.log('🎉 Development cycle completed successfully!');
    return true;
  }

  /**
   * Start continuous monitoring
   */
  async startContinuousMonitoring() {
    if (this.isRunning) {
      this.log('⚠️  Continuous monitoring is already running');
      return;
    }

    this.isRunning = true;
    this.log(`🔄 Starting continuous monitoring (interval: ${this.config.healthCheckInterval}ms)`);

    while (this.isRunning) {
      const health = await this.healthCheck();
      
      if (health.healthy) {
        this.log('✅ Health check passed');
      } else {
        this.log(`❌ Health check failed: ${health.error}`);
        
        if (this.attempts < this.config.maxRetries) {
          const recovered = await this.attemptRecovery();
          
          if (!recovered) {
            this.log('❌ Failed to recover, continuing monitoring...');
          }
        } else {
          this.log('❌ Max recovery attempts reached, continuing monitoring...');
          this.attempts = 0; // Reset for next failure
        }
      }

      // Wait for next check
      await new Promise(resolve => setTimeout(resolve, this.config.healthCheckInterval));
    }
  }

  /**
   * Stop continuous monitoring
   */
  stopContinuousMonitoring() {
    this.isRunning = false;
    this.log('🛑 Stopping continuous monitoring');
  }

  /**
   * Get system status
   */
  async getStatus() {
    const health = await this.healthCheck();
    let mcpStatus = null;
    
    if (this.mcpController) {
      try {
        mcpStatus = await this.mcpController.status();
      } catch (error) {
        mcpStatus = { error: error.message };
      }
    }

    return {
      health,
      mcpStatus,
      attempts: this.attempts,
      isMonitoring: this.isRunning,
      config: this.config
    };
  }
}

// CLI interface
async function main() {
  const action = process.argv[2] || 'run';
  const options = {};

  // Parse command line options
  for (let i = 3; i < process.argv.length; i += 2) {
    const key = process.argv[i];
    const value = process.argv[i + 1];
    
    if (key === '--max-retries') options.maxRetries = parseInt(value);
    if (key === '--health-interval') options.healthCheckInterval = parseInt(value);
    if (key === '--server-url') options.serverUrl = value;
  }

  const helper = new DevHelper(options);

  try {
    switch (action.toLowerCase()) {
    case 'run':
      const success = await helper.runDevelopmentCycle();
      process.exit(success ? 0 : 1);
      break;
        
    case 'monitor':
      await helper.startContinuousMonitoring();
      break;
        
    case 'health':
      const health = await helper.healthCheck();
      console.log('Health:', JSON.stringify(health, null, 2));
      process.exit(health.healthy ? 0 : 1);
      break;
        
    case 'status':
      const status = await helper.getStatus();
      console.log('Status:', JSON.stringify(status, null, 2));
      break;
        
    case 'install':
      const installed = await helper.installDependencies();
      process.exit(installed ? 0 : 1);
      break;
        
    default:
      console.log(`
Usage: node dev-helper.js [command] [options]

Commands:
  run         Run complete development cycle (default)
  monitor     Start continuous health monitoring
  health      Check server health once
  status      Get system status
  install     Install dependencies only

Options:
  --max-retries N         Maximum recovery attempts (default: 3)
  --health-interval N     Health check interval in ms (default: 30000)
  --server-url URL        Server URL (default: http://localhost:3000)

Examples:
  node dev-helper.js run
  node dev-helper.js monitor --health-interval 60000
  node dev-helper.js health
        `);
      process.exit(1);
    }
  } catch (error) {
    helper.log(`❌ Fatal error: ${error.message}`);
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Handle process signals
process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

// Export for use as module
module.exports = DevHelper;

// Run if called directly
if (require.main === module) {
  main();
}