#!/usr/bin/env node
/**
 * MASTER AGENT - Empire Command Center
 * 
 * Central orchestrator that commands and builds all other agents.
 * This is the single source of truth for the entire Empire ecosystem.
 * 
 * Usage:
 *   node master-agent.js start     # Start all agents
 *   node master-agent.js stop      # Stop all agents  
 *   node master-agent.js status    # Show agent status
 *   node master-agent.js restart   # Restart all agents
 *   node master-agent.js deploy    # Deploy to Cloudflare
 *   node master-agent.js income    # Show income dashboard
 */

const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const crypto = require('crypto');
const express = require('express');

// Master Agent Configuration
const MASTER_CONFIG = {
  port: 3001,
  logDir: path.join(process.cwd(), 'logs'),
  pidDir: path.join(process.cwd(), '.pids'),
  dashboardPort: 3001,
  healthCheckInterval: 30000, // 30 seconds
  restartDelay: 5000, // 5 seconds before restart
  security: {
    enableAuth: true,
    adminToken: process.env.ADMIN_TOKEN || crypto.randomBytes(32).toString('hex'),
    maxLoginAttempts: 5,
    lockoutDuration: 300000, // 5 minutes
    sessionTimeout: 3600000, // 1 hour
    enableTLS: false, // Set to true in production
    allowedIPs: process.env.ALLOWED_IPS ? process.env.ALLOWED_IPS.split(',') : [],
    rateLimitWindow: 60000, // 1 minute
    rateLimitMax: 100, // requests per window
    encryptLogs: true,
    auditLevel: 'detailed' // basic, detailed, verbose
  },
  monitoring: {
    enableMetrics: true,
    metricsInterval: 10000, // 10 seconds
    alertThresholds: {
      memoryUsageMB: 200,
      cpuUsagePercent: 80,
      diskUsagePercent: 90,
      errorRate: 10, // errors per minute
      responseTimeMs: 5000
    },
    retention: {
      metrics: 86400000, // 24 hours
      logs: 604800000, // 7 days
      alerts: 2592000000 // 30 days
    }
  }
};

// Agent Registry - All agents under master control
const AGENT_REGISTRY = {
  'payment-monitor': {
    script: './simple-payment-monitor.js',
    description: 'Monitors Monero payments and celebrates milestones',
    autoStart: true,
    healthEndpoint: null, // No HTTP endpoint, monitor via process
    logFile: 'payment-monitor.log',
    env: {}
  },
  'escrow-micro': {
    script: './instant-escrow-system.js',
    description: 'Micro/mid-tier escrow service (port 3500)',
    autoStart: true,
    healthEndpoint: 'http://localhost:3500/health',
    logFile: 'escrow-micro.log',
    env: { PORT: '3500' }
  },
  'escrow-enterprise': {
    script: './enterprise-escrow-system.js', 
    description: 'High-value enterprise escrow service (port 3600)',
    autoStart: true,
    healthEndpoint: 'http://localhost:3600/health',
    logFile: 'escrow-enterprise.log',
    env: { PORT: '3600' }
  },
  'mcp-server': {
    script: './server.js',
    description: 'Main MCP ecosystem server (port 3000)',
    autoStart: true,
    healthEndpoint: 'http://localhost:3000/health',
    logFile: 'mcp-server.log',
    env: { PORT: '3000' }
  },
  'income-service': {
    script: './income-service.js',
    description: 'Income tracking and analytics service (port 3003)',
    autoStart: false, // Optional service
    healthEndpoint: 'http://localhost:3003/health',
    logFile: 'income-service.log',
    env: { PORT: '3003' }
  }
};

class MasterAgent {
  constructor() {
    this.agents = new Map(); // agentName -> { process, config, status, lastHealthCheck }
    this.isShuttingDown = false;
    this.healthCheckTimer = null;
    this.webServer = null;
    this.securityState = {
      loginAttempts: new Map(), // IP -> { count, lockoutUntil }
      activeSessions: new Map(), // sessionId -> { ip, createdAt, lastActivity }
      auditLog: [],
      rateLimits: new Map(), // IP -> { requests: [], window }
      suspiciousActivity: []
    };
    this.metrics = {
      startTime: Date.now(),
      agentRestarts: new Map(), // agentName -> count
      errorCounts: new Map(), // agentName -> error count
      healthCheckHistory: [], // Array of health check results
      performanceMetrics: {
        avgResponseTime: 0,
        memoryTrend: [],
        cpuUsage: [],
        requestCounts: new Map() // endpoint -> count
      },
      systemAlerts: [],
      uptimeStats: new Map() // agentName -> { startTime, totalUptime, downtime }
    };
    
    this.ensureDirectories();
    this.initializeSecurity();
    this.startMetricsCollection();
    this.setupGracefulShutdown();
  }

  initializeSecurity() {
    this.log('🔒 Initializing Empire security systems');
    
    // Generate admin token if not provided
    if (!process.env.ADMIN_TOKEN) {
      this.log(`🔑 Generated admin token: ${MASTER_CONFIG.security.adminToken}`);
      this.log('⚠️  Save this token securely - it will be required for API access');
    }

    // Create security directories
    const securityDir = path.join(MASTER_CONFIG.logDir, 'security');
    if (!fs.existsSync(securityDir)) {
      fs.mkdirSync(securityDir, { recursive: true, mode: 0o700 });
    }

    // Load previous security state if exists
    const securityStateFile = path.join(securityDir, 'security-state.json');
    if (fs.existsSync(securityStateFile)) {
      try {
        const savedState = JSON.parse(fs.readFileSync(securityStateFile, 'utf8'));
        this.securityState.auditLog = savedState.auditLog || [];
        this.securityState.suspiciousActivity = savedState.suspiciousActivity || [];
        this.log('✅ Security state restored from disk');
      } catch (error) {
        this.log(`⚠️  Could not restore security state: ${error.message}`, 'WARN');
      }
    }

    // Start security monitoring
    this.startSecurityMonitoring();
  }

  startSecurityMonitoring() {
    setInterval(() => {
      this.performSecurityChecks();
      this.cleanupExpiredSessions();
      this.saveSecurityState();
    }, 60000); // Every minute
  }

  startMetricsCollection() {
    if (!MASTER_CONFIG.monitoring.enableMetrics) return;

    this.log('📊 Starting comprehensive metrics collection');

    setInterval(() => {
      this.collectSystemMetrics();
      this.collectAgentMetrics();
      this.cleanupOldMetrics();
    }, MASTER_CONFIG.monitoring.metricsInterval);
  }

  collectSystemMetrics() {
    const memUsage = process.memoryUsage();
    const timestamp = Date.now();

    // Memory metrics
    this.metrics.system.memory.push({
      timestamp,
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      rss: memUsage.rss
    });

    // Check thresholds and alert
    const memUsageMB = memUsage.heapUsed / 1024 / 1024;
    if (memUsageMB > MASTER_CONFIG.monitoring.alertThresholds.memoryUsageMB) {
      this.triggerAlert('HIGH_MEMORY_USAGE', {
        current: memUsageMB,
        threshold: MASTER_CONFIG.monitoring.alertThresholds.memoryUsageMB
      });
    }
  }

  collectAgentMetrics() {
    for (const [agentName, agent] of this.agents) {
      if (!this.metrics.agents.has(agentName)) {
        this.metrics.agents.set(agentName, {
          restarts: 0,
          errors: 0,
          uptime: [],
          healthChecks: { successful: 0, failed: 0 }
        });
      }

      const agentMetrics = this.metrics.agents.get(agentName);
      
      // Update uptime
      if (agent.process.exitCode === null) {
        agentMetrics.uptime.push({
          timestamp: Date.now(),
          uptimeMs: Date.now() - agent.startTime
        });
      }
    }
  }

  cleanupOldMetrics() {
    const now = Date.now();
    const retention = MASTER_CONFIG.monitoring.retention.metrics;

    // Clean system metrics
    this.metrics.system.memory = this.metrics.system.memory.filter(
      m => now - m.timestamp < retention
    );

    // Clean agent metrics
    for (const agentMetrics of this.metrics.agents.values()) {
      agentMetrics.uptime = agentMetrics.uptime.filter(
        u => now - u.timestamp < retention
      );
    }
  }

  triggerAlert(alertType, data) {
    const alert = {
      id: crypto.randomBytes(16).toString('hex'),
      timestamp: new Date().toISOString(),
      type: alertType,
      severity: this.getAlertSeverity(alertType),
      data,
      acknowledged: false
    };

    this.log(`🚨 ALERT [${alert.severity}]: ${alertType} - ${JSON.stringify(data)}`, 'WARN');
    
    // Save alert
    const alertsFile = path.join(MASTER_CONFIG.logDir, 'alerts.json');
    let alerts = [];
    if (fs.existsSync(alertsFile)) {
      try {
        alerts = JSON.parse(fs.readFileSync(alertsFile, 'utf8'));
      } catch {}
    }
    alerts.push(alert);
    fs.writeFileSync(alertsFile, JSON.stringify(alerts, null, 2));
  }

  getAlertSeverity(alertType) {
    const severityMap = {
      HIGH_MEMORY_USAGE: 'HIGH',
      AGENT_FAILURE: 'HIGH',
      SECURITY_BREACH: 'CRITICAL',
      SUSPICIOUS_ACTIVITY: 'MEDIUM',
      PORT_CONFLICT: 'LOW'
    };
    return severityMap[alertType] || 'MEDIUM';
  }

  performSecurityChecks() {
    // Check for suspicious activity patterns
    const now = Date.now();
    
    // Check login attempt patterns
    for (const [ip, attempts] of this.securityState.loginAttempts) {
      if (attempts.count > MASTER_CONFIG.security.maxLoginAttempts) {
        this.auditLog('SECURITY_VIOLATION', {
          ip,
          event: 'excessive_login_attempts',
          count: attempts.count
        });
        
        this.triggerAlert('SUSPICIOUS_ACTIVITY', {
          ip,
          type: 'brute_force_attempt',
          attempts: attempts.count
        });
      }
    }

    // Check for unusual agent activity
    for (const [agentName, agent] of this.agents) {
      const agentMetrics = this.metrics.agents.get(agentName);
      if (agentMetrics && agentMetrics.restarts > 5) {
        this.auditLog('AGENT_INSTABILITY', {
          agent: agentName,
          restarts: agentMetrics.restarts
        });
      }
    }
  }

  auditLog(event, data) {
    const auditEntry = {
      timestamp: new Date().toISOString(),
      event,
      data,
      severity: this.getEventSeverity(event)
    };

    this.securityState.auditLog.push(auditEntry);
    
    // Keep only recent audit entries
    const maxEntries = 1000;
    if (this.securityState.auditLog.length > maxEntries) {
      this.securityState.auditLog = this.securityState.auditLog.slice(-maxEntries);
    }

    this.log(`📋 AUDIT: ${event} - ${JSON.stringify(data)}`);
  }

  getEventSeverity(event) {
    const severityMap = {
      SECURITY_VIOLATION: 'HIGH',
      AGENT_INSTABILITY: 'MEDIUM',
      LOGIN_SUCCESS: 'LOW',
      LOGIN_FAILURE: 'MEDIUM'
    };
    return severityMap[event] || 'LOW';
  }

  cleanupExpiredSessions() {
    const now = Date.now();
    const timeout = MASTER_CONFIG.security.sessionTimeout;

    for (const [sessionId, session] of this.securityState.activeSessions) {
      if (now - session.lastActivity > timeout) {
        this.securityState.activeSessions.delete(sessionId);
        this.auditLog('SESSION_EXPIRED', { sessionId, ip: session.ip });
      }
    }
  }

  saveSecurityState() {
    const securityDir = path.join(MASTER_CONFIG.logDir, 'security');
    const stateFile = path.join(securityDir, 'security-state.json');
    
    const state = {
      auditLog: this.securityState.auditLog.slice(-100), // Keep last 100 entries
      suspiciousActivity: this.securityState.suspiciousActivity.slice(-50),
      lastSaved: new Date().toISOString()
    };

    try {
      fs.writeFileSync(stateFile, JSON.stringify(state, null, 2), { mode: 0o600 });
    } catch (error) {
      this.log(`⚠️  Could not save security state: ${error.message}`, 'WARN');
    }
  }

  authenticateRequest(req) {
    const token = req.headers.authorization?.replace('Bearer ', '') || req.query.token;
    const clientIP = req.ip || req.connection.remoteAddress;

    // Check rate limiting
    if (!this.checkRateLimit(clientIP)) {
      this.auditLog('RATE_LIMIT_EXCEEDED', { ip: clientIP });
      return { authenticated: false, reason: 'rate_limit_exceeded' };
    }

    // Check IP whitelist
    if (MASTER_CONFIG.security.allowedIPs.length > 0 && 
        !MASTER_CONFIG.security.allowedIPs.includes(clientIP)) {
      this.auditLog('IP_NOT_ALLOWED', { ip: clientIP });
      return { authenticated: false, reason: 'ip_not_allowed' };
    }

    // Check lockout
    const attempts = this.securityState.loginAttempts.get(clientIP);
    if (attempts && attempts.lockoutUntil > Date.now()) {
      this.auditLog('LOGIN_BLOCKED', { ip: clientIP, lockoutUntil: attempts.lockoutUntil });
      return { authenticated: false, reason: 'locked_out' };
    }

    // Validate token
    if (!token || token !== MASTER_CONFIG.security.adminToken) {
      this.recordFailedLogin(clientIP);
      return { authenticated: false, reason: 'invalid_token' };
    }

    // Success
    this.recordSuccessfulLogin(clientIP);
    return { authenticated: true, sessionId: this.createSession(clientIP) };
  }

  checkRateLimit(ip) {
    const now = Date.now();
    const window = MASTER_CONFIG.security.rateLimitWindow;
    const maxRequests = MASTER_CONFIG.security.rateLimitMax;

    if (!this.securityState.rateLimits.has(ip)) {
      this.securityState.rateLimits.set(ip, { requests: [], window: now });
    }

    const rateLimit = this.securityState.rateLimits.get(ip);
    
    // Clean old requests
    rateLimit.requests = rateLimit.requests.filter(req => now - req < window);
    
    // Check limit
    if (rateLimit.requests.length >= maxRequests) {
      return false;
    }

    rateLimit.requests.push(now);
    return true;
  }

  recordFailedLogin(ip) {
    if (!this.securityState.loginAttempts.has(ip)) {
      this.securityState.loginAttempts.set(ip, { count: 0, lockoutUntil: 0 });
    }

    const attempts = this.securityState.loginAttempts.get(ip);
    attempts.count++;

    if (attempts.count >= MASTER_CONFIG.security.maxLoginAttempts) {
      attempts.lockoutUntil = Date.now() + MASTER_CONFIG.security.lockoutDuration;
      this.auditLog('IP_LOCKED_OUT', { ip, attempts: attempts.count });
    }

    this.auditLog('LOGIN_FAILURE', { ip, attempts: attempts.count });
    this.metrics.security.authAttempts++;
  }

  recordSuccessfulLogin(ip) {
    // Reset failed attempts on successful login
    this.securityState.loginAttempts.delete(ip);
    this.auditLog('LOGIN_SUCCESS', { ip });
  }

  createSession(ip) {
    const sessionId = crypto.randomBytes(32).toString('hex');
    this.securityState.activeSessions.set(sessionId, {
      ip,
      createdAt: Date.now(),
      lastActivity: Date.now()
    });
    return sessionId;
  }
    this.startMetricsCollection();
  }

  ensureDirectories() {
    [MASTER_CONFIG.logDir, MASTER_CONFIG.pidDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  setupGracefulShutdown() {
    ['SIGINT', 'SIGTERM', 'SIGUSR1', 'SIGUSR2'].forEach(signal => {
      process.on(signal, () => {
        console.log(`\n🛑 Master Agent received ${signal} - Graceful shutdown initiated`);
        this.shutdown();
      });
    });

    process.on('uncaughtException', (error) => {
      console.error('🚨 Master Agent uncaught exception:', error);
      this.shutdown();
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('🚨 Master Agent unhandled rejection:', reason);
      this.shutdown();
    });
  }

  log(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [MASTER-${level}] ${message}`;
    console.log(logMessage);
    
    // Write to master log file
    const logFile = path.join(MASTER_CONFIG.logDir, 'master-agent.log');
    fs.appendFileSync(logFile, logMessage + '\n');
  }

  async startAgent(agentName) {
    const config = AGENT_REGISTRY[agentName];
    if (!config) {
      this.log(`❌ Unknown agent: ${agentName}`, 'ERROR');
      return false;
    }

    if (this.agents.has(agentName)) {
      this.log(`⚠️  Agent ${agentName} already running`);
      return true;
    }

    this.log(`🚀 Starting agent: ${agentName} - ${config.description}`);

    try {
      const logFile = path.join(MASTER_CONFIG.logDir, config.logFile);
      const logStream = fs.createWriteStream(logFile, { flags: 'a' });

      const childProcess = spawn('node', [config.script], {
        cwd: process.cwd(),
        env: { ...process.env, ...config.env },
        stdio: ['ignore', 'pipe', 'pipe']
      });

      // Pipe stdout/stderr to log file
      childProcess.stdout.pipe(logStream);
      childProcess.stderr.pipe(logStream);

      // Store PID for external monitoring
      const pidFile = path.join(MASTER_CONFIG.pidDir, `${agentName}.pid`);
      fs.writeFileSync(pidFile, childProcess.pid.toString());

      childProcess.on('exit', (code, signal) => {
        this.log(`🔄 Agent ${agentName} exited with code ${code} signal ${signal}`);
        this.agents.delete(agentName);
        
        // Clean up PID file
        if (fs.existsSync(pidFile)) {
          fs.unlinkSync(pidFile);
        }

        // Auto-restart if not shutting down and agent should auto-start
        if (!this.isShuttingDown && config.autoStart) {
          this.log(`🔄 Auto-restarting agent ${agentName} in ${MASTER_CONFIG.restartDelay}ms`);
          setTimeout(() => this.startAgent(agentName), MASTER_CONFIG.restartDelay);
        }
      });

      childProcess.on('error', (error) => {
        this.log(`❌ Agent ${agentName} error: ${error.message}`, 'ERROR');
      });

      this.agents.set(agentName, {
        process: childProcess,
        config,
        status: 'starting',
        lastHealthCheck: null,
        startTime: Date.now()
      });

      // Wait a moment for process to stabilize
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Check if process is still alive
      if (childProcess.exitCode === null) {
        this.agents.get(agentName).status = 'running';
        this.log(`✅ Agent ${agentName} started successfully (PID: ${childProcess.pid})`);
        return true;
      } else {
        this.log(`❌ Agent ${agentName} failed to start`, 'ERROR');
        return false;
      }

    } catch (error) {
      this.log(`❌ Failed to start agent ${agentName}: ${error.message}`, 'ERROR');
      return false;
    }
  }

  async stopAgent(agentName) {
    const agent = this.agents.get(agentName);
    if (!agent) {
      this.log(`⚠️  Agent ${agentName} not running`);
      return true;
    }

    this.log(`🛑 Stopping agent: ${agentName}`);

    try {
      agent.process.kill('SIGTERM');
      
      // Wait for graceful shutdown
      await new Promise((resolve) => {
        const timeout = setTimeout(() => {
          this.log(`⚡ Force killing agent ${agentName}`, 'WARN');
          agent.process.kill('SIGKILL');
          resolve();
        }, 10000);

        agent.process.on('exit', () => {
          clearTimeout(timeout);
          resolve();
        });
      });

      this.agents.delete(agentName);
      this.log(`✅ Agent ${agentName} stopped`);
      return true;

    } catch (error) {
      this.log(`❌ Error stopping agent ${agentName}: ${error.message}`, 'ERROR');
      return false;
    }
  }

  async checkAgentHealth(agentName) {
    const agent = this.agents.get(agentName);
    if (!agent) return false;

    // If no health endpoint, just check if process is alive
    if (!agent.config.healthEndpoint) {
      const isAlive = agent.process.exitCode === null;
      agent.status = isAlive ? 'running' : 'stopped';
      agent.lastHealthCheck = Date.now();
      return isAlive;
    }

    // HTTP health check
    try {
      const response = await this.httpGet(agent.config.healthEndpoint);
      const isHealthy = response.includes('ok') || response.includes('healthy') || response.includes('running');
      agent.status = isHealthy ? 'healthy' : 'unhealthy';
      agent.lastHealthCheck = Date.now();
      return isHealthy;
    } catch (error) {
      agent.status = 'unreachable';
      agent.lastHealthCheck = Date.now();
      return false;
    }
  }

  httpGet(url) {
    return new Promise((resolve, reject) => {
      const request = http.get(url, { timeout: 5000 }, (response) => {
        let data = '';
        response.on('data', chunk => data += chunk);
        response.on('end', () => resolve(data));
      });
      
      request.on('error', reject);
      request.on('timeout', () => {
        request.destroy();
        reject(new Error('Health check timeout'));
      });
    });
  }

  async healthCheckLoop() {
    if (this.isShuttingDown) return;

    this.log('🔍 Running health checks on all agents');
    
    for (const [agentName, agent] of this.agents) {
      const isHealthy = await this.checkAgentHealth(agentName);
      if (!isHealthy && agent.config.autoStart) {
        this.log(`🚨 Agent ${agentName} unhealthy - restarting`, 'WARN');
        await this.stopAgent(agentName);
        await this.startAgent(agentName);
      }
    }

    this.healthCheckTimer = setTimeout(() => this.healthCheckLoop(), MASTER_CONFIG.healthCheckInterval);
  }

  async startAllAgents() {
    this.log('🚀 MASTER AGENT - Starting Empire ecosystem');
    this.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const autoStartAgents = Object.keys(AGENT_REGISTRY).filter(name => 
      AGENT_REGISTRY[name].autoStart
    );

    for (const agentName of autoStartAgents) {
      await this.startAgent(agentName);
    }

    // Start health monitoring
    this.healthCheckLoop();

    // Start web dashboard
    this.startWebDashboard();

    this.log('✅ All agents started - Empire ecosystem operational');
    this.log(`📊 Master dashboard available at: http://localhost:${MASTER_CONFIG.dashboardPort}`);
  }

  async stopAllAgents() {
    this.log('🛑 Stopping all agents');
    
    if (this.healthCheckTimer) {
      clearTimeout(this.healthCheckTimer);
    }

    const agentNames = Array.from(this.agents.keys());
    for (const agentName of agentNames) {
      await this.stopAgent(agentName);
    }

    if (this.webServer) {
      this.webServer.close();
    }

    this.log('✅ All agents stopped');
  }

  async restartAllAgents() {
    this.log('🔄 Restarting all agents');
    await this.stopAllAgents();
    await new Promise(resolve => setTimeout(resolve, 2000));
    await this.startAllAgents();
  }

  getStatus() {
    const status = {
      masterAgent: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString()
      },
      agents: {}
    };

    for (const [agentName, agent] of this.agents) {
      status.agents[agentName] = {
        status: agent.status,
        pid: agent.process.pid,
        uptime: Date.now() - agent.startTime,
        lastHealthCheck: agent.lastHealthCheck,
        description: agent.config.description
      };
    }

    return status;
  }

  startWebDashboard() {
    const app = express();
    
    app.get('/', (req, res) => {
      const status = this.getStatus();
      res.json({
        empire: 'MASTER AGENT OPERATIONAL',
        ...status
      });
    });

    app.get('/health', (req, res) => {
      res.json({ status: 'MASTER AGENT HEALTHY', timestamp: new Date().toISOString() });
    });

    app.get('/agents', (req, res) => {
      res.json(this.getStatus().agents);
    });

    app.post('/agents/:name/restart', async (req, res) => {
      const agentName = req.params.name;
      if (!AGENT_REGISTRY[agentName]) {
        return res.status(404).json({ error: 'Agent not found' });
      }

      await this.stopAgent(agentName);
      const success = await this.startAgent(agentName);
      res.json({ restarted: success, agent: agentName });
    });

    // Try multiple ports in case 3001 is busy
    const tryPorts = [3001, 3011, 3021, 3031];
    
    const tryNextPort = (index) => {
      if (index >= tryPorts.length) {
        this.log('❌ Could not start web dashboard - all ports in use', 'ERROR');
        return;
      }

      const port = tryPorts[index];
      this.webServer = app.listen(port)
        .on('listening', () => {
          this.log(`📊 Master dashboard listening on port ${port}`);
          MASTER_CONFIG.dashboardPort = port; // Update config with actual port
        })
        .on('error', (error) => {
          if (error.code === 'EADDRINUSE') {
            this.log(`⚠️  Port ${port} in use, trying next port`, 'WARN');
            tryNextPort(index + 1);
          } else {
            this.log(`❌ Dashboard server error: ${error.message}`, 'ERROR');
          }
        });
    };

    tryNextPort(0);
  }

  async deployToCloudflare() {
    this.log('☁️  Deploying Empire to Cloudflare Workers');
    
    return new Promise((resolve, reject) => {
      exec('npm run publish:worker', (error, stdout, stderr) => {
        if (error) {
          this.log(`❌ Cloudflare deployment failed: ${error.message}`, 'ERROR');
          reject(error);
        } else {
          this.log('✅ Successfully deployed to Cloudflare Workers');
          this.log(stdout);
          resolve(stdout);
        }
      });
    });
  }

  async showIncomeDashboard() {
    this.log('💰 Empire Income Dashboard');
    this.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Read current progress
    const progressFile = path.join(process.cwd(), 'MICRO-PROGRESS.md');
    if (fs.existsSync(progressFile)) {
      const content = fs.readFileSync(progressFile, 'utf8');
      console.log(content);
    } else {
      this.log('📊 No income progress file found - run payment monitor first');
    }

    // Show recent income logs
    const incomeLog = path.join(MASTER_CONFIG.logDir, 'income.json');
    if (fs.existsSync(incomeLog)) {
      try {
        const income = JSON.parse(fs.readFileSync(incomeLog, 'utf8'));
        const total = income.reduce((sum, entry) => sum + entry.usd_est, 0);
        this.log(`💎 Total Income: $${total.toFixed(2)} (${income.length} payments)`);
      } catch (error) {
        this.log('⚠️  Could not parse income log', 'WARN');
      }
    }
  }

  async runDiagnostics() {
    this.log('🔍 EMPIRE DIAGNOSTICS - Analyzing system health');
    this.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const diagnostics = {
      system: await this.checkSystemDiagnostics(),
      agents: await this.checkAgentDiagnostics(),
      files: await this.checkFileDiagnostics(),
      ports: await this.checkPortDiagnostics(),
      dependencies: await this.checkDependencyDiagnostics(),
      recommendations: []
    };

    // Generate recommendations based on findings
    diagnostics.recommendations = this.generateRecommendations(diagnostics);

    // Display results
    this.displayDiagnosticResults(diagnostics);
    
    return diagnostics;
  }

  async checkSystemDiagnostics() {
    const diagnostics = {
      memory: process.memoryUsage(),
      uptime: process.uptime(),
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      cwd: process.cwd(),
      env: {
        NODE_ENV: process.env.NODE_ENV || 'undefined',
        PORT: process.env.PORT || 'undefined',
        HOME: process.env.HOME || 'undefined'
      }
    };

    // Memory check
    const memoryMB = diagnostics.memory.heapUsed / 1024 / 1024;
    diagnostics.memoryHealth = memoryMB < 100 ? 'good' : memoryMB < 200 ? 'warning' : 'critical';

    return diagnostics;
  }

  async checkAgentDiagnostics() {
    const agentDiag = {};
    
    for (const [agentName, config] of Object.entries(AGENT_REGISTRY)) {
      const agent = this.agents.get(agentName);
      const scriptPath = path.join(process.cwd(), config.script);
      
      agentDiag[agentName] = {
        registered: true,
        scriptExists: fs.existsSync(scriptPath),
        isRunning: agent ? agent.process.exitCode === null : false,
        status: agent ? agent.status : 'not_started',
        pid: agent ? agent.process.pid : null,
        uptime: agent ? Date.now() - agent.startTime : 0,
        lastHealth: agent ? agent.lastHealthCheck : null,
        healthEndpoint: config.healthEndpoint,
        logFile: path.join(MASTER_CONFIG.logDir, config.logFile),
        hasLogFile: fs.existsSync(path.join(MASTER_CONFIG.logDir, config.logFile)),
        autoStart: config.autoStart
      };

      // Check recent errors in log file
      if (agentDiag[agentName].hasLogFile) {
        try {
          const logContent = fs.readFileSync(agentDiag[agentName].logFile, 'utf8');
          const lines = logContent.split('\n').slice(-10); // Last 10 lines
          agentDiag[agentName].recentErrors = lines.filter(line => 
            line.toLowerCase().includes('error') || 
            line.toLowerCase().includes('failed') ||
            line.toLowerCase().includes('cannot')
          ).slice(-3); // Last 3 errors
        } catch (error) {
          agentDiag[agentName].logReadError = error.message;
        }
      }
    }

    return agentDiag;
  }

  async checkFileDiagnostics() {
    const requiredFiles = [
      'package.json',
      'server.js',
      'simple-payment-monitor.js',
      'instant-escrow-system.js',
      'enterprise-escrow-system.js',
      'master-agent.js',
      'README.md'
    ];

    const fileDiag = {};
    
    for (const file of requiredFiles) {
      const filePath = path.join(process.cwd(), file);
      fileDiag[file] = {
        exists: fs.existsSync(filePath),
        size: fs.existsSync(filePath) ? fs.statSync(filePath).size : 0,
        readable: false,
        executable: false
      };

      if (fileDiag[file].exists) {
        try {
          fs.accessSync(filePath, fs.constants.R_OK);
          fileDiag[file].readable = true;
        } catch {}

        try {
          fs.accessSync(filePath, fs.constants.X_OK);
          fileDiag[file].executable = true;
        } catch {}
      }
    }

    // Check directory structure
    const requiredDirs = ['logs', '.pids', 'scripts'];
    fileDiag.directories = {};
    
    for (const dir of requiredDirs) {
      const dirPath = path.join(process.cwd(), dir);
      fileDiag.directories[dir] = {
        exists: fs.existsSync(dirPath),
        writable: false
      };

      if (fileDiag.directories[dir].exists) {
        try {
          fs.accessSync(dirPath, fs.constants.W_OK);
          fileDiag.directories[dir].writable = true;
        } catch {}
      }
    }

    return fileDiag;
  }

  async checkPortDiagnostics() {
    const testPorts = [3000, 3001, 3003, 3500, 3600];
    const portDiag = {};

    for (const port of testPorts) {
      portDiag[port] = await this.checkPortAvailability(port);
    }

    return portDiag;
  }

  async checkPortAvailability(port) {
    return new Promise((resolve) => {
      const server = http.createServer();
      
      server.listen(port, () => {
        server.close(() => {
          resolve({ available: true, inUse: false, service: null });
        });
      });

      server.on('error', async (error) => {
        if (error.code === 'EADDRINUSE') {
          // Try to identify what's using the port
          const service = await this.identifyPortService(port);
          resolve({ available: false, inUse: true, service });
        } else {
          resolve({ available: false, inUse: false, error: error.message });
        }
      });
    });
  }

  async identifyPortService(port) {
    try {
      const response = await this.httpGet(`http://localhost:${port}/health`);
      if (response.includes('empire') || response.includes('escrow') || response.includes('mcp')) {
        return 'empire-service';
      }
      return 'unknown-service';
    } catch {
      return 'unknown';
    }
  }

  async checkDependencyDiagnostics() {
    const deps = {};
    
    // Check package.json
    try {
      const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      deps.packageJson = { exists: true, dependencies: Object.keys(packageJson.dependencies || {}).length };
    } catch (error) {
      deps.packageJson = { exists: false, error: error.message };
    }

    // Check node_modules
    deps.nodeModules = fs.existsSync('node_modules');

    // Check key dependencies
    const keyDeps = ['express', 'axios', 'ws'];
    deps.keyDependencies = {};
    
    for (const dep of keyDeps) {
      try {
        require.resolve(dep);
        deps.keyDependencies[dep] = { available: true };
      } catch (error) {
        deps.keyDependencies[dep] = { available: false, error: error.message };
      }
    }

    return deps;
  }

  generateRecommendations(diagnostics) {
    const recommendations = [];

    // System recommendations
    if (diagnostics.system.memoryHealth === 'critical') {
      recommendations.push({
        priority: 'high',
        category: 'system',
        issue: 'High memory usage detected',
        solution: 'Restart master agent or check for memory leaks'
      });
    }

    // Agent recommendations
    for (const [agentName, agentInfo] of Object.entries(diagnostics.agents)) {
      if (!agentInfo.scriptExists) {
        recommendations.push({
          priority: 'high',
          category: 'agent',
          issue: `Agent script missing: ${agentName}`,
          solution: `Create ${agentInfo.script} or check file path`
        });
      }

      if (agentInfo.recentErrors && agentInfo.recentErrors.length > 0) {
        recommendations.push({
          priority: 'medium',
          category: 'agent',
          issue: `Recent errors in ${agentName}`,
          solution: `Check log: ${agentInfo.logFile}`,
          details: agentInfo.recentErrors[0]
        });
      }

      if (agentInfo.autoStart && !agentInfo.isRunning) {
        recommendations.push({
          priority: 'medium',
          category: 'agent',
          issue: `Auto-start agent not running: ${agentName}`,
          solution: `Run: node master-agent.js restart`
        });
      }
    }

    // File recommendations
    for (const [filename, fileInfo] of Object.entries(diagnostics.files)) {
      if (filename !== 'directories' && !fileInfo.exists) {
        recommendations.push({
          priority: 'high',
          category: 'files',
          issue: `Missing required file: ${filename}`,
          solution: `Create ${filename} or check repository integrity`
        });
      }
    }

    // Port recommendations
    for (const [port, portInfo] of Object.entries(diagnostics.ports)) {
      if (portInfo.inUse && portInfo.service === 'unknown') {
        recommendations.push({
          priority: 'low',
          category: 'ports',
          issue: `Port ${port} occupied by unknown service`,
          solution: `Check what's using port ${port}: lsof -i :${port}`
        });
      }
    }

    // Dependency recommendations
    for (const [dep, depInfo] of Object.entries(diagnostics.dependencies.keyDependencies || {})) {
      if (!depInfo.available) {
        recommendations.push({
          priority: 'high',
          category: 'dependencies',
          issue: `Missing dependency: ${dep}`,
          solution: `Run: npm install ${dep}`
        });
      }
    }

    return recommendations;
  }

  displayDiagnosticResults(diagnostics) {
    // System Status
    this.log(`\n🖥️  SYSTEM STATUS`);
    this.log(`   Memory: ${(diagnostics.system.memory.heapUsed / 1024 / 1024).toFixed(1)}MB (${diagnostics.system.memoryHealth})`);
    this.log(`   Uptime: ${Math.floor(diagnostics.system.uptime)}s`);
    this.log(`   Node: ${diagnostics.system.nodeVersion} on ${diagnostics.system.platform}`);

    // Agent Status
    this.log(`\n🤖 AGENT STATUS`);
    for (const [agentName, agentInfo] of Object.entries(diagnostics.agents)) {
      const status = agentInfo.isRunning ? '✅ Running' : 
                    agentInfo.scriptExists ? '⏸️  Stopped' : '❌ Missing';
      this.log(`   ${agentName}: ${status}${agentInfo.pid ? ` (PID: ${agentInfo.pid})` : ''}`);
      
      if (agentInfo.recentErrors && agentInfo.recentErrors.length > 0) {
        this.log(`     ⚠️  Recent error: ${agentInfo.recentErrors[0].substring(0, 60)}...`);
      }
    }

    // Port Status
    this.log(`\n🔌 PORT STATUS`);
    for (const [port, portInfo] of Object.entries(diagnostics.ports)) {
      const status = portInfo.available ? '✅ Available' : 
                    portInfo.service === 'empire-service' ? '🏛️  Empire' :
                    portInfo.inUse ? '❌ In Use' : '⚠️  Error';
      this.log(`   Port ${port}: ${status}`);
    }

    // Recommendations
    if (diagnostics.recommendations.length > 0) {
      this.log(`\n💡 RECOMMENDATIONS`);
      diagnostics.recommendations.forEach((rec, i) => {
        const priority = rec.priority === 'high' ? '🔴' : rec.priority === 'medium' ? '🟡' : '🟢';
        this.log(`   ${priority} ${rec.issue}`);
        this.log(`      → ${rec.solution}`);
        if (rec.details) this.log(`      Details: ${rec.details}`);
      });
    } else {
      this.log(`\n✅ NO ISSUES FOUND - Empire is healthy!`);
    }

    this.log(`\n🔧 QUICK FIXES`);
    this.log(`   npm install              # Fix missing dependencies`);
    this.log(`   node master-agent.js restart  # Restart all agents`);
    this.log(`   pkill -f node            # Kill stuck processes`);
    this.log(`   rm -rf logs/*.log        # Clear error logs`);
  }

  async shutdown() {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;

    this.log('🛑 Master Agent shutdown initiated');
    await this.stopAllAgents();
    this.log('👋 Master Agent shutdown complete');
    process.exit(0);
  }
}

// CLI Interface
async function main() {
  const command = process.argv[2] || 'help';
  const master = new MasterAgent();

  switch (command) {
    case 'start':
      await master.startAllAgents();
      // Keep process alive
      process.stdin.resume();
      break;

    case 'stop':
      await master.stopAllAgents();
      break;

    case 'restart':
      await master.restartAllAgents();
      process.stdin.resume();
      break;

    case 'status':
      const status = master.getStatus();
      console.log(JSON.stringify(status, null, 2));
      break;

    case 'deploy':
      try {
        await master.deployToCloudflare();
      } catch (error) {
        console.error('Deployment failed:', error.message);
        process.exit(1);
      }
      break;

    case 'income':
      await master.showIncomeDashboard();
      break;

    case 'diagnose':
    case 'debug':
    case 'fix':
      await master.runDiagnostics();
      break;

    case 'help':
    default:
      console.log(`
🏛️  EMPIRE MASTER AGENT - Command Center

Usage: node master-agent.js <command>

Commands:
  start     Start all Empire agents and services
  stop      Stop all running agents
  restart   Restart all agents
  status    Show status of all agents
  deploy    Deploy Empire to Cloudflare Workers
  income    Show income dashboard and progress
  diagnose  Run comprehensive diagnostics and debugging
  debug     Alias for diagnose
  fix       Alias for diagnose
  help      Show this help message

Dashboard: http://localhost:${MASTER_CONFIG.dashboardPort}

Examples:
  node master-agent.js start     # Start the Empire
  node master-agent.js diagnose  # Find and fix issues
  node master-agent.js income    # Check earnings
  node master-agent.js deploy    # Go global on Cloudflare

Debugging:
  node master-agent.js diagnose  # Comprehensive system analysis
  tail -f logs/master-agent.log  # Watch real-time logs
  curl http://localhost:3001/agents  # Check agent API
      `);
      break;
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('Master Agent error:', error);
    process.exit(1);
  });
}

module.exports = { MasterAgent, AGENT_REGISTRY, MASTER_CONFIG };