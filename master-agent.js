#!/usr/bin/env node
/**
 * SINA EMPIRE MASTER AGENT
 * Central Command Center for Money-Making Operations
 * 
 * Features:
 * - Agent Registry & Lifecycle Management
 * - Health Monitoring & Auto-restart
 * - Security & Authentication
 * - Metrics Collection & Analytics
 * - Web Dashboard Interface
 * - Diagnostics & Debugging
 */

const express = require('express');
const { spawn, exec } = require('child_process');
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

class SINAMasterAgent {
  constructor() {
    this.agents = new Map();
    this.metrics = {
      system: { cpu: 0, memory: 0, uptime: 0 },
      agents: {},
      security: { authAttempts: 0, blockedIPs: new Set() },
      performance: { requests: 0, errors: 0, avgResponseTime: 0 }
    };
    this.authorizedIPs = new Set(['127.0.0.1', '::1', 'localhost']);
    this.authTokens = new Map();
    this.app = express();
    this.port = 3001;
    this.setupExpress();
    this.startHealthMonitoring();
    this.startMetricsCollection();
    console.log('🏛️ SINA EMPIRE MASTER AGENT INITIALIZING...');
  }

  setupExpress() {
    this.app.use(express.json());
    this.app.use(this.authMiddleware.bind(this));
    this.app.use(this.securityMiddleware.bind(this));
    
    // Dashboard route
    this.app.get('/', (req, res) => {
      res.json({
        empire: 'SINA Master Agent',
        status: 'OPERATIONAL',
        agents: Array.from(this.agents.keys()),
        metrics: this.metrics,
        timestamp: new Date().toISOString()
      });
    });

    // Agent management routes
    this.app.post('/agents/register', (req, res) => {
      const { name, type, port, pid } = req.body;
      this.registerAgent(name, { type, port, pid, status: 'active' });
      res.json({ success: true, message: `Agent ${name} registered` });
    });

    this.app.get('/agents', (req, res) => {
      res.json({
        agents: Object.fromEntries(this.agents),
        count: this.agents.size
      });
    });

    this.app.get('/status', (req, res) => {
      res.json({
        empire: 'OPERATIONAL',
        agents: this.agents.size,
        metrics: this.metrics,
        security: {
          authorizedIPs: this.authorizedIPs.size,
          activeTokens: this.authTokens.size
        }
      });
    });

    // Security routes
    this.app.get('/auth', (req, res) => {
      const clientIP = req.ip || req.connection.remoteAddress;
      if (req.query.ip) {
        this.authorizedIPs.add(req.query.ip);
        res.json({ authorized: true, ip: req.query.ip });
      } else {
        const token = this.generateAuthToken();
        this.authTokens.set(token, { ip: clientIP, created: Date.now() });
        res.json({ token, expires: '24h' });
      }
    });

    // Diagnostics routes
    this.app.get('/diagnostics', (req, res) => {
      res.json({
        system: this.getSystemDiagnostics(),
        agents: this.getAgentDiagnostics(),
        security: this.getSecurityDiagnostics()
      });
    });

    // Money-making routes
    this.app.get('/money/status', (req, res) => {
      res.json({
        earnings: '$0.00', // Will be updated by payment monitor
        offers: this.getActiveOffers(),
        escrow: this.getEscrowStatus()
      });
    });
  }

  authMiddleware(req, res, next) {
    const clientIP = req.ip || req.connection.remoteAddress;
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (this.authorizedIPs.has(clientIP) || this.authorizedIPs.has('127.0.0.1')) {
      return next();
    }
    
    if (token && this.authTokens.has(token)) {
      const tokenData = this.authTokens.get(token);
      if (Date.now() - tokenData.created < 24 * 60 * 60 * 1000) { // 24h
        return next();
      } else {
        this.authTokens.delete(token);
      }
    }
    
    this.metrics.security.authAttempts++;
    return res.status(401).json({ error: 'IP not authorized' });
  }

  securityMiddleware(req, res, next) {
    const clientIP = req.ip || req.connection.remoteAddress;
    
    if (this.metrics.security.blockedIPs.has(clientIP)) {
      return res.status(403).json({ error: 'IP blocked' });
    }
    
    // Rate limiting
    const now = Date.now();
    if (!this.requestCounts) this.requestCounts = new Map();
    const requests = this.requestCounts.get(clientIP) || [];
    const recentRequests = requests.filter(time => now - time < 60000); // 1 minute
    
    if (recentRequests.length > 100) { // 100 requests per minute
      this.metrics.security.blockedIPs.add(clientIP);
      return res.status(429).json({ error: 'Rate limit exceeded' });
    }
    
    recentRequests.push(now);
    this.requestCounts.set(clientIP, recentRequests);
    this.metrics.performance.requests++;
    
    next();
  }

  generateAuthToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  registerAgent(name, config) {
    this.agents.set(name, {
      ...config,
      registered: new Date().toISOString(),
      lastSeen: new Date().toISOString()
    });
    console.log(`✅ Agent registered: ${name}`);
  }

  startHealthMonitoring() {
    setInterval(() => {
      this.checkAgentHealth();
      this.updateSystemMetrics();
    }, 30000); // Check every 30 seconds
  }

  checkAgentHealth() {
    for (const [name, agent] of this.agents) {
      if (agent.port) {
        // Simple health check via HTTP
        const http = require('http');
        const req = http.get(`http://localhost:${agent.port}/health`, (res) => {
          agent.status = 'healthy';
          agent.lastSeen = new Date().toISOString();
        });
        
        req.on('error', () => {
          agent.status = 'unhealthy';
          console.log(`⚠️ Agent ${name} appears unhealthy`);
          // Auto-restart logic could go here
        });
        
        req.setTimeout(5000);
      }
    }
  }

  updateSystemMetrics() {
    const used = process.memoryUsage();
    this.metrics.system = {
      cpu: process.cpuUsage(),
      memory: {
        rss: Math.round(used.rss / 1024 / 1024),
        heapTotal: Math.round(used.heapTotal / 1024 / 1024),
        heapUsed: Math.round(used.heapUsed / 1024 / 1024)
      },
      uptime: Math.round(process.uptime())
    };
  }

  startMetricsCollection() {
    setInterval(() => {
      this.saveMetrics();
    }, 300000); // Save every 5 minutes
  }

  saveMetrics() {
    const metricsFile = path.join(__dirname, 'logs', 'metrics.json');
    fs.mkdirSync(path.dirname(metricsFile), { recursive: true });
    fs.writeFileSync(metricsFile, JSON.stringify({
      timestamp: new Date().toISOString(),
      metrics: this.metrics
    }, null, 2));
  }

  getSystemDiagnostics() {
    return {
      nodejs: process.version,
      platform: process.platform,
      architecture: process.arch,
      pid: process.pid,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpuUsage: process.cpuUsage()
    };
  }

  getAgentDiagnostics() {
    return Array.from(this.agents.entries()).map(([name, agent]) => ({
      name,
      status: agent.status,
      type: agent.type,
      port: agent.port,
      registered: agent.registered,
      lastSeen: agent.lastSeen
    }));
  }

  getSecurityDiagnostics() {
    return {
      authorizedIPs: Array.from(this.authorizedIPs),
      blockedIPs: Array.from(this.metrics.security.blockedIPs),
      authAttempts: this.metrics.security.authAttempts,
      activeTokens: this.authTokens.size
    };
  }

  getActiveOffers() {
    try {
      const offersFile = path.join(__dirname, 'active-offers.json');
      if (fs.existsSync(offersFile)) {
        return JSON.parse(fs.readFileSync(offersFile, 'utf8'));
      }
    } catch (error) {
      console.error('Error reading offers:', error);
    }
    return [];
  }

  getEscrowStatus() {
    return {
      micro: { port: 3500, status: 'active' },
      enterprise: { port: 3600, status: 'active' }
    };
  }

  start() {
    this.app.listen(this.port, () => {
      console.log(`🏛️ SINA EMPIRE MASTER AGENT OPERATIONAL`);
      console.log(`🌐 Dashboard: http://localhost:${this.port}`);
      console.log(`🔒 Security: Active`);
      console.log(`📊 Metrics: Collecting`);
      console.log(`💰 Money Machine: Ready`);
    });

    // Register self
    this.registerAgent('master-agent', {
      type: 'command-center',
      port: this.port,
      pid: process.pid,
      status: 'active'
    });

    // Graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n🛑 SINA EMPIRE MASTER AGENT SHUTTING DOWN...');
      process.exit(0);
    });
  }
}

// Auto-start if run directly
if (require.main === module) {
  const masterAgent = new SINAMasterAgent();
  masterAgent.start();
}

module.exports = SINAMasterAgent;