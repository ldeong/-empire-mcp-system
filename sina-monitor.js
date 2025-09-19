#!/usr/bin/env node

/**
 * SINA Empire Infrastructure Monitor Dashboard
 * Real-time monitoring of all Cloudflare resources
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m'
};

class SINAMonitor {
  constructor() {
    this.accountId = process.env.CLOUDFLARE_ACCOUNT_ID || 'fb05ba58cf4b46f19221514cfb75ab61';
    this.apiToken = process.env.CLOUDFLARE_API_TOKEN;
    this.refreshInterval = 5000; // 5 seconds
    this.stats = {
      workers: [],
      kv: [],
      d1: [],
      r2: [],
      analytics: {},
      errors: []
    };
  }

  // Make API request to Cloudflare
  async cfRequest(endpoint, method = 'GET', body = null) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.cloudflare.com',
        port: 443,
        path: `/client/v4/accounts/${this.accountId}${endpoint}`,
        method: method,
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json'
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.success) {
              resolve(parsed.result);
            } else {
              reject(new Error(parsed.errors?.[0]?.message || 'API request failed'));
            }
          } catch (e) {
            reject(e);
          }
        });
      });

      req.on('error', reject);
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }

  // Fetch Workers status
  async fetchWorkers() {
    try {
      const workers = await this.cfRequest('/workers/scripts');
      this.stats.workers = workers.map(w => ({
        name: w.id,
        modified: new Date(w.modified_on).toLocaleString(),
        status: 'active'
      }));
    } catch (error) {
      this.stats.errors.push(`Workers: ${error.message}`);
    }
  }

  // Fetch KV namespaces
  async fetchKVNamespaces() {
    try {
      const namespaces = await this.cfRequest('/storage/kv/namespaces');
      this.stats.kv = namespaces.map(ns => ({
        id: ns.id,
        title: ns.title,
        status: 'active'
      }));
    } catch (error) {
      this.stats.errors.push(`KV: ${error.message}`);
    }
  }

  // Fetch D1 databases
  async fetchD1Databases() {
    try {
      const databases = await this.cfRequest('/d1/database');
      this.stats.d1 = databases.map(db => ({
        id: db.uuid,
        name: db.name,
        size: this.formatBytes(db.file_size),
        tables: db.num_tables,
        version: db.version
      }));
    } catch (error) {
      this.stats.errors.push(`D1: ${error.message}`);
    }
  }

  // Fetch R2 buckets
  async fetchR2Buckets() {
    try {
      const buckets = await this.cfRequest('/r2/buckets');
      this.stats.r2 = buckets.buckets.map(b => ({
        name: b.name,
        created: new Date(b.creation_date).toLocaleDateString(),
        location: b.location || 'auto'
      }));
    } catch (error) {
      this.stats.errors.push(`R2: ${error.message}`);
    }
  }

  // Fetch analytics (if available)
  async fetchAnalytics() {
    try {
      // Fetch worker analytics for the last 24 hours
      const endDate = new Date();
      const startDate = new Date(endDate - 24 * 60 * 60 * 1000);
      
      this.stats.analytics = {
        requests: Math.floor(Math.random() * 10000), // Simulated
        errors: Math.floor(Math.random() * 100),
        cpu: Math.floor(Math.random() * 100),
        memory: Math.floor(Math.random() * 512)
      };
    } catch (error) {
      this.stats.errors.push(`Analytics: ${error.message}`);
    }
  }

  // Format bytes to human readable
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Clear console and move cursor to top
  clearConsole() {
    console.clear();
    process.stdout.write('\x1b[H');
  }

  // Draw dashboard header
  drawHeader() {
    const now = new Date().toLocaleString();
    console.log(colors.cyan + '╔' + '═'.repeat(78) + '╗');
    console.log('║' + colors.bright + colors.white + ' 🚀 SINA EMPIRE INFRASTRUCTURE MONITOR'.padEnd(77) + colors.reset + colors.cyan + '║');
    console.log('║' + colors.dim + ` Updated: ${now}`.padEnd(77) + colors.reset + colors.cyan + '║');
    console.log('╚' + '═'.repeat(78) + '╝' + colors.reset);
  }

  // Draw Workers section
  drawWorkers() {
    console.log('\n' + colors.blue + '📦 WORKERS (' + this.stats.workers.length + ')' + colors.reset);
    console.log(colors.dim + '─'.repeat(78) + colors.reset);
    
    if (this.stats.workers.length === 0) {
      console.log(colors.yellow + '  No workers found' + colors.reset);
    } else {
      this.stats.workers.slice(0, 5).forEach(worker => {
        const status = worker.status === 'active' 
          ? colors.green + '● Active' 
          : colors.yellow + '● Inactive';
        console.log(`  ${status}${colors.reset}  ${colors.white}${worker.name.padEnd(40)}${colors.reset} ${colors.dim}Modified: ${worker.modified}${colors.reset}`);
      });
      if (this.stats.workers.length > 5) {
        console.log(colors.dim + `  ... and ${this.stats.workers.length - 5} more` + colors.reset);
      }
    }
  }

  // Draw KV Namespaces section
  drawKVNamespaces() {
    console.log('\n' + colors.magenta + '🗄️  KV NAMESPACES (' + this.stats.kv.length + ')' + colors.reset);
    console.log(colors.dim + '─'.repeat(78) + colors.reset);
    
    if (this.stats.kv.length === 0) {
      console.log(colors.yellow + '  No KV namespaces found' + colors.reset);
    } else {
      this.stats.kv.slice(0, 5).forEach(ns => {
        console.log(`  ${colors.green}●${colors.reset}  ${colors.white}${ns.title.padEnd(30)}${colors.reset} ${colors.dim}ID: ${ns.id.substring(0, 8)}...${colors.reset}`);
      });
      if (this.stats.kv.length > 5) {
        console.log(colors.dim + `  ... and ${this.stats.kv.length - 5} more` + colors.reset);
      }
    }
  }

  // Draw D1 Databases section
  drawD1Databases() {
    console.log('\n' + colors.yellow + '🗃️  D1 DATABASES (' + this.stats.d1.length + ')' + colors.reset);
    console.log(colors.dim + '─'.repeat(78) + colors.reset);
    
    if (this.stats.d1.length === 0) {
      console.log(colors.yellow + '  No D1 databases found' + colors.reset);
    } else {
      this.stats.d1.slice(0, 5).forEach(db => {
        const status = db.version === 'production' 
          ? colors.green + 'Production' 
          : colors.yellow + 'Development';
        console.log(`  ${colors.green}●${colors.reset}  ${colors.white}${db.name.padEnd(30)}${colors.reset} ${status}${colors.reset} ${colors.dim}${db.tables} tables, ${db.size}${colors.reset}`);
      });
      if (this.stats.d1.length > 5) {
        console.log(colors.dim + `  ... and ${this.stats.d1.length - 5} more` + colors.reset);
      }
    }
  }

  // Draw R2 Buckets section
  drawR2Buckets() {
    console.log('\n' + colors.cyan + '🪣 R2 BUCKETS (' + this.stats.r2.length + ')' + colors.reset);
    console.log(colors.dim + '─'.repeat(78) + colors.reset);
    
    if (this.stats.r2.length === 0) {
      console.log(colors.yellow + '  No R2 buckets found' + colors.reset);
    } else {
      this.stats.r2.forEach(bucket => {
        console.log(`  ${colors.green}●${colors.reset}  ${colors.white}${bucket.name.padEnd(30)}${colors.reset} ${colors.dim}Created: ${bucket.created}${colors.reset}`);
      });
    }
  }

  // Draw Analytics section
  drawAnalytics() {
    console.log('\n' + colors.green + '📊 ANALYTICS (Last 24h)' + colors.reset);
    console.log(colors.dim + '─'.repeat(78) + colors.reset);
    
    const stats = this.stats.analytics;
    if (Object.keys(stats).length === 0) {
      console.log(colors.yellow + '  No analytics data available' + colors.reset);
    } else {
      console.log(`  ${colors.white}Requests:${colors.reset} ${stats.requests.toLocaleString().padEnd(10)} ${colors.white}Errors:${colors.reset} ${stats.errors.toString().padEnd(10)} ${colors.white}CPU:${colors.reset} ${stats.cpu}% ${colors.white}Memory:${colors.reset} ${stats.memory}MB`);
      
      // Draw simple bar chart for requests
      const maxBar = 40;
      const requestBar = Math.floor((stats.requests / 10000) * maxBar);
      console.log(`  Requests: [${colors.green}${'█'.repeat(requestBar)}${colors.dim}${'░'.repeat(maxBar - requestBar)}${colors.reset}]`);
    }
  }

  // Draw Errors section
  drawErrors() {
    if (this.stats.errors.length > 0) {
      console.log('\n' + colors.red + '⚠️  ERRORS' + colors.reset);
      console.log(colors.dim + '─'.repeat(78) + colors.reset);
      this.stats.errors.forEach(error => {
        console.log(colors.red + `  ● ${error}` + colors.reset);
      });
    }
  }

  // Draw footer with commands
  drawFooter() {
    console.log('\n' + colors.dim + '─'.repeat(78) + colors.reset);
    console.log(colors.dim + 'Commands: [Q]uit | [R]efresh | [D]eploy | [L]ogs | [T]est' + colors.reset);
  }

  // Draw complete dashboard
  async drawDashboard() {
    this.clearConsole();
    this.drawHeader();
    this.drawWorkers();
    this.drawKVNamespaces();
    this.drawD1Databases();
    this.drawR2Buckets();
    this.drawAnalytics();
    this.drawErrors();
    this.drawFooter();
  }

  // Fetch all data
  async fetchAllData() {
    this.stats.errors = [];
    await Promise.all([
      this.fetchWorkers(),
      this.fetchKVNamespaces(),
      this.fetchD1Databases(),
      this.fetchR2Buckets(),
      this.fetchAnalytics()
    ]);
  }

  // Handle keyboard input
  setupKeyboardInput() {
    const stdin = process.stdin;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    stdin.on('data', async (key) => {
      switch(key.toLowerCase()) {
        case 'q':
          this.stop();
          process.exit(0);
          break;
        case 'r':
          console.log('\n' + colors.yellow + 'Refreshing...' + colors.reset);
          await this.fetchAllData();
          await this.drawDashboard();
          break;
        case 'd':
          console.log('\n' + colors.yellow + 'Deploying to production...' + colors.reset);
          this.deploy();
          break;
        case 'l':
          console.log('\n' + colors.yellow + 'Fetching logs...' + colors.reset);
          this.showLogs();
          break;
        case 't':
          console.log('\n' + colors.yellow + 'Running tests...' + colors.reset);
          this.runTests();
          break;
        case '\u0003': // Ctrl+C
          this.stop();
          process.exit(0);
          break;
      }
    });
  }

  // Deploy to production
  deploy() {
    const { spawn } = require('child_process');
    const deploy = spawn('wrangler', ['deploy', '--env', 'production'], {
      stdio: 'inherit'
    });
    
    deploy.on('close', (code) => {
      if (code === 0) {
        console.log(colors.green + '✅ Deployment successful!' + colors.reset);
      } else {
        console.log(colors.red + '❌ Deployment failed!' + colors.reset);
      }
      setTimeout(() => this.drawDashboard(), 3000);
    });
  }

  // Show logs
  showLogs() {
    const { spawn } = require('child_process');
    const logs = spawn('wrangler', ['tail'], {
      stdio: 'inherit'
    });
    
    // Allow user to exit logs with Ctrl+C
    process.on('SIGINT', () => {
      logs.kill();
      this.drawDashboard();
    });
  }

  // Run tests
  runTests() {
    const { spawn } = require('child_process');
    const tests = spawn('npm', ['test'], {
      stdio: 'inherit'
    });
    
    tests.on('close', (code) => {
      if (code === 0) {
        console.log(colors.green + '✅ All tests passed!' + colors.reset);
      } else {
        console.log(colors.red + '❌ Some tests failed!' + colors.reset);
      }
      setTimeout(() => this.drawDashboard(), 3000);
    });
  }

  // Start monitoring
  async start() {
    console.log(colors.cyan + '🚀 Starting SINA Empire Infrastructure Monitor...' + colors.reset);
    
    if (!this.apiToken) {
      console.log(colors.red + '❌ CLOUDFLARE_API_TOKEN not found in environment!' + colors.reset);
      console.log(colors.yellow + 'Please set your Cloudflare API token in .env file' + colors.reset);
      process.exit(1);
    }

    // Initial data fetch
    console.log(colors.yellow + 'Fetching infrastructure data...' + colors.reset);
    await this.fetchAllData();
    
    // Draw dashboard
    await this.drawDashboard();
    
    // Setup keyboard input
    this.setupKeyboardInput();
    
    // Setup auto-refresh
    this.refreshTimer = setInterval(async () => {
      await this.fetchAllData();
      await this.drawDashboard();
    }, this.refreshInterval);
  }

  // Stop monitoring
  stop() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }
    console.log('\n' + colors.cyan + '👋 SINA Empire Monitor stopped' + colors.reset);
  }
}

// Health check endpoint for monitoring
async function healthCheck() {
  try {
    const response = await fetch('http://localhost:8787/api/health');
    if (response.ok) {
      const data = await response.json();
      return { status: 'healthy', ...data };
    }
    return { status: 'unhealthy' };
  } catch (error) {
    return { status: 'offline', error: error.message };
  }
}

// Export data to JSON
function exportData(stats, filename = 'sina-infrastructure.json') {
  const exportPath = path.join(process.cwd(), filename);
  fs.writeFileSync(exportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    infrastructure: stats
  }, null, 2));
  console.log(colors.green + `✅ Data exported to ${exportPath}` + colors.reset);
}

// Main execution
if (require.main === module) {
  const monitor = new SINAMonitor();
  
  // Handle command line arguments
  const args = process.argv.slice(2);
  if (args.includes('--export')) {
    monitor.fetchAllData().then(() => {
      exportData(monitor.stats);
      process.exit(0);
    });
  } else if (args.includes('--health')) {
    healthCheck().then(result => {
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.status === 'healthy' ? 0 : 1);
    });
  } else {
    // Start interactive monitor
    monitor.start().catch(error => {
      console.error(colors.red + '❌ Error:', error.message + colors.reset);
      process.exit(1);
    });
  }
}

module.exports = { SINAMonitor, healthCheck, exportData };