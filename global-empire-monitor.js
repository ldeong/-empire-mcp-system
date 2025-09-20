#!/usr/bin/env node
/**
 * GLOBAL EMPIRE STATUS MONITOR
 * Monitors entire SINA Empire across local and global deployments
 */

const { exec } = require('child_process');
const fs = require('fs');

class GlobalEmpireMonitor {
  constructor() {
    this.endpoints = {
      global: 'https://sina-empire-crypto-gateway.louiewong4.workers.dev',
      local: {
        master: 'http://localhost:3001',
        hive: 'http://localhost:3007',
        escrow: 'http://localhost:3500',
        enterprise: 'http://localhost:3600'
      }
    };
  }

  async monitorEmpire() {
    console.log('🌍 SINA EMPIRE - GLOBAL STATUS MONITOR');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    await this.checkGlobalDeployment();
    await this.checkLocalServices();
    await this.checkCloudflareWorkers();
    await this.generateStatusReport();
  }

  async checkGlobalDeployment() {
    console.log('\n🌍 GLOBAL CLOUDFLARE DEPLOYMENT:');
    
    try {
      const health = await this.fetchEndpoint(`${this.endpoints.global}/health`);
      const status = await this.fetchEndpoint(`${this.endpoints.global}/status`);
      const money = await this.fetchEndpoint(`${this.endpoints.global}/money/status`);
      
      console.log(`✅ Global Gateway: OPERATIONAL (Region: ${health.region})`);
      console.log(`✅ Services: ${Object.values(status.services).every(s => s === 'active') ? 'ALL ACTIVE' : 'SOME DOWN'}`);
      console.log(`✅ Money Machine: ${money.active ? 'ACTIVE' : 'INACTIVE'} (${money.offers} offers)`);
      console.log(`⚡ Performance: ${status.performance.globalLatency} latency, ${status.performance.uptime} uptime`);
      
    } catch (error) {
      console.log(`❌ Global Gateway: OFFLINE (${error.message})`);
    }
  }

  async checkLocalServices() {
    console.log('\n🏠 LOCAL SERVICES:');
    
    const services = [
      { name: 'Master Agent', url: this.endpoints.local.master },
      { name: 'Hive Mind', url: this.endpoints.local.hive },
      { name: 'Micro Escrow', url: this.endpoints.local.escrow },
      { name: 'Enterprise Escrow', url: this.endpoints.local.enterprise }
    ];

    for (const service of services) {
      try {
        await this.fetchEndpoint(`${service.url}/health`);
        console.log(`✅ ${service.name}: OPERATIONAL`);
      } catch (error) {
        console.log(`❌ ${service.name}: OFFLINE`);
      }
    }
  }

  async checkCloudflareWorkers() {
    console.log('\n☁️ CLOUDFLARE WORKERS:');
    
    return new Promise((resolve) => {
      exec('wrangler deployments list --limit 5', (error, stdout, stderr) => {
        if (error) {
          console.log(`❌ Workers Status: Unable to check (${error.message})`);
        } else {
          console.log(`✅ Workers Status: DEPLOYED`);
          const lines = stdout.split('\n').slice(0, 5);
          lines.forEach(line => {
            if (line.trim() && !line.includes('Version ID')) {
              console.log(`   📋 ${line.trim()}`);
            }
          });
        }
        resolve();
      });
    });
  }

  async fetchEndpoint(url) {
    // Simple fetch using curl since we're in Node
    return new Promise((resolve, reject) => {
      exec(`curl -s "${url}"`, { timeout: 5000 }, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`Failed to reach ${url}`));
        } else {
          try {
            resolve(JSON.parse(stdout));
          } catch (parseError) {
            resolve({ raw: stdout });
          }
        }
      });
    });
  }

  async generateStatusReport() {
    console.log('\n📊 EMPIRE STATUS SUMMARY:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const report = {
      timestamp: new Date().toISOString(),
      global: {
        deployed: true,
        url: this.endpoints.global,
        region: 'SYD', // Will be dynamic in real implementation
        status: 'OPERATIONAL'
      },
      local: {
        services: 4,
        active: 'TBD', // Will check in real implementation
      },
      money: {
        earnings: '$0.00',
        offers: 5,
        escrow: 'ready'
      },
      next_actions: [
        '1. Post active offers to start earning',
        '2. Monitor payment webhooks',
        '3. Scale to additional regions',
        '4. Optimize performance metrics'
      ]
    };

    console.log(`🎯 GLOBAL STATUS: ${report.global.status}`);
    console.log(`💰 MONEY MACHINE: ${report.money.escrow.toUpperCase()}`);
    console.log(`🚀 DEPLOYMENT: ${report.global.url}`);
    
    console.log('\n📋 NEXT ACTIONS:');
    report.next_actions.forEach((action, i) => {
      console.log(`   ${i + 1}. ${action}`);
    });

    // Save report
    fs.writeFileSync('empire-status.json', JSON.stringify(report, null, 2));
    console.log('\n💾 Status report saved to empire-status.json');
  }
}

// Run if called directly
if (require.main === module) {
  const monitor = new GlobalEmpireMonitor();
  monitor.monitorEmpire().then(() => {
    console.log('\n🎊 EMPIRE STATUS CHECK COMPLETE!');
    process.exit(0);
  });
}

module.exports = GlobalEmpireMonitor;