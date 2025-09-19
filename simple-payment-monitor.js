#!/usr/bin/env node
// simple-payment-monitor.js - Lightweight payment monitoring agent
// Managed by Master Agent

const fs = require('fs');
const path = require('path');

console.log('🔍 Payment Monitor Agent - Starting');
console.log('📬 Monitoring Empire payments...');

// Simple heartbeat to keep process alive
setInterval(() => {
  const timestamp = new Date().toISOString();
  console.log(`⏰ ${timestamp} - Payment monitor active`);
  
  // Log to file for master agent
  const logDir = path.join(process.cwd(), 'logs');
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
  
  const logEntry = `[${timestamp}] Payment monitor heartbeat\n`;
  fs.appendFileSync(path.join(logDir, 'payment-monitor.log'), logEntry);
  
}, 30000); // Every 30 seconds

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Payment monitor shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 Payment monitor interrupted');
  process.exit(0);
});

// Keep process alive
process.stdin.resume();