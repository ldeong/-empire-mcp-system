#!/usr/bin/env node
/**
 * scripts/mcp-control.js
 * Node helper to start/stop/restart MCP. Integrates with mcp-ecosystem-manager.js when available.
 *
 * Usage:
 *   node scripts/mcp-control.js start|stop|restart|status
 *
 * Emits human-readable logs to dev-helper.log
 */

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const LOG = path.join(process.cwd(), 'dev-helper.log');

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  fs.appendFileSync(LOG, line + '\n');
  console.log(line);
}

async function tryManagerMethod(method, ...args) {
  const mgrPath = path.join(__dirname, '..', 'mcp-ecosystem-manager.js');
  if (fs.existsSync(mgrPath)) {
    try {
      const manager = require(mgrPath);
      if (manager && typeof manager[method] === 'function') {
        log(`Invoking mcp-ecosystem-manager.js.${method}()`);
        const res = manager[method](...args);
        if (res && typeof res.then === 'function') {
          await res;
        }
        return true;
      }
    } catch (err) {
      log(`Manager ${method} threw error: ${err && err.stack ? err.stack : err}`);
    }
  }
  return false;
}

function spawnDetached(cmd, args = [], opts = {}) {
  const out = fs.openSync(LOG, 'a');
  const err = fs.openSync(LOG, 'a');
  const child = spawn(cmd, args, Object.assign({
    detached: true,
    stdio: ['ignore', out, err],
    shell: false,
  }, opts));
  child.unref();
  return child;
}

function isProcessRunning() {
  try {
    const out = execSync(`pgrep -af "node|npm" || true`).toString();
    return /server\.js|npm start|node .*server\.js/i.test(out);
  } catch (e) {
    return false;
  }
}

async function startServer() {
  log('startServer: attempting to use manager hook if present.');
  if (await tryManagerMethod('start')) {
    log('startServer: manager start executed.');
    return;
  }

  try {
    log('startServer: spawning `npm start` (detached). Logs -> dev-helper.log');
    spawnDetached('npm', ['start']);
    log('startServer: npm start launched.');
    return;
  } catch (e) {
    log('startServer: npm start failed: ' + e);
  }

  if (fs.existsSync(path.join(process.cwd(), 'server.js'))) {
    try {
      log('startServer: spawning `node server.js` (detached).');
      spawnDetached('node', ['server.js']);
      log('startServer: node server.js launched.');
      return;
    } catch (e) {
      log('startServer: node server.js failed: ' + e);
    }
  }

  throw new Error('No start method succeeded. Please inspect dev-helper.log');
}

async function stopServer() {
  log('stopServer: attempting to use manager hook if present.');
  if (await tryManagerMethod('stop')) {
    log('stopServer: manager stop executed.');
    return;
  }
  try {
    log('stopServer: attempting to pkill node server processes.');
    execSync(`pkill -f "node server.js" || true`);
    execSync(`pkill -f "npm start" || true`);
    log('stopServer: pkill attempted.');
  } catch (e) {
    log('stopServer: pkill error: ' + e);
  }
}

async function restartServer() {
  log('restartServer: attempting manager restart.');
  if (await tryManagerMethod('restart')) {
    log('restartServer: manager restart executed.');
    return;
  }
  await stopServer();
  await new Promise(r => setTimeout(r, 2000));
  await startServer();
}

function status() {
  const running = isProcessRunning();
  log(`status: running=${running}`);
  process.exit(running ? 0 : 1);
}

async function main() {
  const cmd = (process.argv[2] || 'status').toLowerCase();
  try {
    if (cmd === 'start') {
      await startServer();
    } else if (cmd === 'stop') {
      await stopServer();
    } else if (cmd === 'restart') {
      await restartServer();
    } else if (cmd === 'status') {
      status();
    } else {
      console.error('Usage: node scripts/mcp-control.js [start|stop|restart|status]');
      process.exit(2);
    }
  } catch (err) {
    log('mcp-control error: ' + (err && err.stack ? err.stack : err));
    process.exit(1);
  }
}

main();