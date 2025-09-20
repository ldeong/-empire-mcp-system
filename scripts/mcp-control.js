#!/usr/bin/env node

/**
 * MCP Control Script
 * Manages starting, stopping, and restarting the MCP server
 * Integrates with mcp-ecosystem-manager.js when available
 */

const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');

class MCPController {
  constructor() {
    this.projectRoot = path.resolve(__dirname, '..');
    this.logFile = path.join(this.projectRoot, 'dev-helper.log');
    this.mcpManager = null;
    this.serverProcess = null;
    
    this.initializeMCPManager();
  }

  /**
   * Try to initialize the MCP ecosystem manager
   */
  initializeMCPManager() {
    try {
      const mcpEcosystemPath = path.join(this.projectRoot, 'mcp-ecosystem-manager.js');
      if (fs.existsSync(mcpEcosystemPath)) {
        const { SinaMCPManager } = require(mcpEcosystemPath);
        this.mcpManager = new SinaMCPManager();
        this.log('✅ MCP Ecosystem Manager initialized successfully');
      } else {
        this.log('⚠️  MCP Ecosystem Manager not found, using fallback methods');
      }
    } catch (error) {
      this.log(`⚠️  Failed to initialize MCP Ecosystem Manager: ${error.message}`);
      this.log('Using fallback methods for MCP control');
    }
  }

  /**
   * Log messages with timestamp
   */
  log(message) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}\n`;
    
    console.log(message);
    
    try {
      fs.appendFileSync(this.logFile, logEntry);
    } catch (error) {
      console.error('Failed to write to log file:', error.message);
    }
  }

  /**
   * Check if MCP server is running
   */
  async isServerRunning() {
    return new Promise((resolve) => {
      exec('pgrep -f "node.*server.js"', (error, stdout) => {
        resolve(stdout.trim().length > 0);
      });
    });
  }

  /**
   * Get running MCP server PIDs
   */
  async getServerPids() {
    return new Promise((resolve) => {
      exec('pgrep -f "node.*server.js"', (error, stdout) => {
        if (error || !stdout.trim()) {
          resolve([]);
        } else {
          resolve(stdout.trim().split('\n').filter(pid => pid));
        }
      });
    });
  }

  /**
   * Stop MCP server
   */
  async stop() {
    this.log('🛑 Stopping MCP server...');
    
    try {
      if (this.mcpManager && typeof this.mcpManager.stop === 'function') {
        await this.mcpManager.stop();
        this.log('✅ MCP server stopped via ecosystem manager');
        return { success: true, method: 'ecosystem-manager' };
      }
    } catch (error) {
      this.log(`⚠️  Failed to stop via ecosystem manager: ${error.message}`);
    }

    // Fallback: kill processes by PID
    const pids = await this.getServerPids();
    if (pids.length === 0) {
      this.log('ℹ️  No MCP server processes found');
      return { success: true, method: 'no-processes' };
    }

    for (const pid of pids) {
      try {
        process.kill(parseInt(pid), 'SIGTERM');
        this.log(`✅ Terminated process ${pid}`);
      } catch (error) {
        this.log(`⚠️  Failed to terminate process ${pid}: ${error.message}`);
        try {
          process.kill(parseInt(pid), 'SIGKILL');
          this.log(`✅ Force killed process ${pid}`);
        } catch (killError) {
          this.log(`❌ Failed to force kill process ${pid}: ${killError.message}`);
        }
      }
    }

    return { success: true, method: 'pid-kill' };
  }

  /**
   * Start MCP server
   */
  async start() {
    this.log('🚀 Starting MCP server...');

    // Check if already running
    if (await this.isServerRunning()) {
      this.log('ℹ️  MCP server is already running');
      return { success: true, method: 'already-running' };
    }

    try {
      if (this.mcpManager && typeof this.mcpManager.start === 'function') {
        await this.mcpManager.start();
        this.log('✅ MCP server started via ecosystem manager');
        return { success: true, method: 'ecosystem-manager' };
      }
    } catch (error) {
      this.log(`⚠️  Failed to start via ecosystem manager: ${error.message}`);
    }

    // Fallback: spawn npm start or node server.js
    return new Promise((resolve) => {
      const packageJsonPath = path.join(this.projectRoot, 'package.json');
      let command, args;

      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        if (packageJson.scripts && packageJson.scripts.start) {
          command = 'npm';
          args = ['start'];
        } else {
          command = 'node';
          args = ['server.js'];
        }
      } else {
        command = 'node';
        args = ['server.js'];
      }

      this.log(`Starting with: ${command} ${args.join(' ')}`);

      this.serverProcess = spawn(command, args, {
        cwd: this.projectRoot,
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let startupOutput = '';
      const timeout = setTimeout(() => {
        this.log('⚠️  Server startup timeout, but process may still be starting');
        resolve({ success: true, method: 'fallback-spawn', timeout: true });
      }, 10000);

      this.serverProcess.stdout.on('data', (data) => {
        const output = data.toString();
        startupOutput += output;
        this.log(`Server output: ${output.trim()}`);
        
        if (output.includes('listening') || output.includes('started') || output.includes('ready')) {
          clearTimeout(timeout);
          this.log('✅ MCP server started successfully');
          this.serverProcess.unref(); // Allow process to continue without parent
          resolve({ success: true, method: 'fallback-spawn' });
        }
      });

      this.serverProcess.stderr.on('data', (data) => {
        const error = data.toString();
        this.log(`Server error: ${error.trim()}`);
      });

      this.serverProcess.on('error', (error) => {
        clearTimeout(timeout);
        this.log(`❌ Failed to start server: ${error.message}`);
        resolve({ success: false, error: error.message, method: 'fallback-spawn' });
      });

      this.serverProcess.on('exit', (code) => {
        clearTimeout(timeout);
        if (code === 0) {
          this.log('Server exited normally');
        } else {
          this.log(`❌ Server exited with code ${code}`);
          resolve({ success: false, error: `Server exited with code ${code}`, method: 'fallback-spawn' });
        }
      });
    });
  }

  /**
   * Restart MCP server
   */
  async restart() {
    this.log('🔄 Restarting MCP server...');
    
    const stopResult = await this.stop();
    
    // Wait a moment for cleanup
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const startResult = await this.start();
    
    return {
      success: stopResult.success && startResult.success,
      stop: stopResult,
      start: startResult
    };
  }

  /**
   * Get server status
   */
  async status() {
    const isRunning = await this.isServerRunning();
    const pids = await this.getServerPids();
    
    return {
      running: isRunning,
      pids: pids,
      hasManager: !!this.mcpManager
    };
  }
}

// CLI interface
async function main() {
  const controller = new MCPController();
  const action = process.argv[2] || 'status';

  try {
    let result;
    
    switch (action.toLowerCase()) {
    case 'start':
      result = await controller.start();
      break;
    case 'stop':
      result = await controller.stop();
      break;
    case 'restart':
      result = await controller.restart();
      break;
    case 'status':
      result = await controller.status();
      break;
    default:
      console.log('Usage: node mcp-control.js [start|stop|restart|status]');
      process.exit(1);
    }

    console.log('\n📊 Result:', JSON.stringify(result, null, 2));
    
    if (result.success === false) {
      process.exit(1);
    }
  } catch (error) {
    controller.log(`❌ Fatal error: ${error.message}`);
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Export for use as module
module.exports = MCPController;

// Run if called directly
if (require.main === module) {
  main();
}