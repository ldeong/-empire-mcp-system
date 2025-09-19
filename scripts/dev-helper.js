#!/usr/bin/env node
/**
 * scripts/dev-helper.js
 * - Ensures dependencies installed
 * - Ensures MCP server is running and healthy with retries and exponential backoff
 * - Runs node test-mcp-ecosystem.js
 * - If tests or health fail, automatically triggers restart via scripts/mcp-control.js
 * - Logs everything to dev-helper.log
 *
 * Usage: node scripts/dev-helper.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

const LOG = path.join(process.cwd(), 'dev-helper.log');
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  fs.appendFileSync(LOG, line + '\n');
  console.log(line);
}

function runCmd(cmd, opts = {}) {
  log(`runCmd: ${cmd}`);
  try {
    execSync(cmd, Object.assign({ stdio: 'inherit' }, opts));
    return { ok: true };
  } catch (err) {
    log(`runCmd ERROR: ${err && err.message ? err.message : err}`);
    return { ok: false, err };
  }
}

function httpGet(url, timeout = 3000) {
  return new Promise((resolve) => {
    const req = http.get(url, { timeout }, (res) => {
      const code = res.statusCode || 0;
      res.on('data', () => { });
      res.on('end', () => resolve({ ok: code >= 200 && code < 400, code }));
    });
    req.on('error', () => resolve({ ok: false }));
    req.on('timeout', () => { req.destroy(); resolve({ ok: false }); });
  });
}

async function ensureDeps() {
  if (!fs.existsSync('package.json')) {
    log('No package.json found; skipping npm install.');
    return true;
  }
  log('Ensuring npm dependencies installed (npm ci preferred in CI)...');
  const res = runCmd('npm install');
  return res.ok;
}

async function healthCheck(url = 'http://localhost:3000/health') {
  log(`healthCheck: checking ${url}`);
  try {
    const r = await httpGet(url, 3000);
    log(`healthCheck: ok=${r.ok} status=${r.code || 'n/a'}`);
    return r.ok;
  } catch (e) {
    log('healthCheck error: ' + (e && e.message ? e.message : e));
    return false;
  }
}

function runTests() {
  if (!fs.existsSync('test-mcp-ecosystem.js')) {
    log('No test-mcp-ecosystem.js found; skipping tests.');
    return true;
  }
  log('Running test-mcp-ecosystem.js...');
  const res = runCmd('node test-mcp-ecosystem.js');
  return res.ok;
}

async function attemptRestartWithBackoff(maxAttempts = 5, baseMs = 2000) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    log(`attemptRestartWithBackoff: attempt ${attempt}/${maxAttempts}`);
    const res = runCmd('node scripts/mcp-control.js restart');
    if (!res.ok) {
      log('Restart command returned non-zero.');
    }
    const wait = baseMs * Math.pow(2, attempt - 1);
    log(`Waiting ${wait} ms before health re-check`);
    await new Promise(r => setTimeout(r, wait));
    const healthy = await healthCheck();
    if (healthy) {
      log('Server healthy after restart attempt.');
      return true;
    } else {
      log('Server still unhealthy after attempt.');
    }
  }
  log('All restart attempts exhausted.');
  return false;
}

async function main() {
  log('========== MCP Dev Helper ==========');
  if (!await ensureDeps()) {
    log('Dependency installation failed. Aborting.');
    process.exit(1);
  }

  const maxStartAttempts = 3;
  let startAttempt = 1;
  let serverHealthy = false;

  // Try to ensure server is running and healthy
  while (startAttempt <= maxStartAttempts && !serverHealthy) {
    log(`Health check attempt ${startAttempt}/${maxStartAttempts}`);
    serverHealthy = await healthCheck();
    
    if (!serverHealthy) {
      log('Server not healthy. Attempting restart...');
      if (!await attemptRestartWithBackoff()) {
        log('Failed to get server healthy after restart attempts.');
        if (startAttempt === maxStartAttempts) {
          log('Exhausted all start attempts. Aborting.');
          process.exit(1);
        }
      } else {
        serverHealthy = true;
      }
    }
    startAttempt++;
  }

  if (!serverHealthy) {
    log('Unable to achieve healthy server state. Aborting.');
    process.exit(1);
  }

  log('Server is healthy. Running tests...');
  const testsPass = runTests();
  
  if (!testsPass) {
    log('Tests failed. Attempting to restart server and retry...');
    if (await attemptRestartWithBackoff()) {
      log('Server restarted successfully. Re-running tests...');
      const retryTests = runTests();
      if (!retryTests) {
        log('Tests still failing after restart. Manual intervention may be needed.');
        process.exit(1);
      } else {
        log('Tests now pass after restart.');
      }
    } else {
      log('Failed to restart server after test failure.');
      process.exit(1);
    }
  }

  log('========== MCP Dev Helper Complete ==========');
  log('All checks passed! Server is healthy and tests are passing.');
}

main();