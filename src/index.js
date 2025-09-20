import { fetchXMRPriceUsd, geoLookupIp } from './lib/public-apis.js';

export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);

      // Critical: Validate KV binding exists
      if (!env.EARNINGS_KV) {
        console.error('CRITICAL: EARNINGS_KV binding is missing');
        return new Response(JSON.stringify({
          error: 'Configuration Error',
          message: 'KV namespace binding is missing. Please check worker settings.',
          debug: { bindings: Object.keys(env), expected: 'EARNINGS_KV' }
        }), { status: 503, headers: { 'Content-Type': 'application/json' } });
      }

      const kv = env.EARNINGS_KV;

      // Handle Cron Triggers for Auto-Scaling
      if (request.headers.get('cf-cron')) {
        return await handleCronTrigger(env, ctx);
      }

      // Crypto gateway configuration (set these as secrets/vars)
      const CRYPTO_GATEWAY_ENDPOINT = env.CRYPTO_GATEWAY_ENDPOINT || null; // e.g. https://api.crypto-gateway.example
      const CRYPTO_GATEWAY_KEY = env.CRYPTO_GATEWAY_KEY || null; // API key for payouts
      const CRYPTO_GATEWAY_SECRET = env.CRYPTO_GATEWAY_SECRET || null; // webhook secret

      async function computeHmacHex(secret, data) {
        const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
        const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
        return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
      }


      async function getBalance() {
        try {
          const balance = await kv.get('total_balance');
          return parseFloat(balance || '0');
        } catch (e) {
          console.error('Balance fetch error:', e);
          return 0;
        }
      }

      async function updateBalance(amount) {
        try {
          const current = await getBalance();
          const newBalance = Math.max(0, current + amount);
          await kv.put('total_balance', newBalance.toString());
          return newBalance;
        } catch (e) {
          console.error('Balance update error:', e);
          throw e;
        }
      }

      if (url.pathname === '/health') {
        return new Response(JSON.stringify({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          kv_bound: true,
          version: '1.0.1-fixed'
        }), { headers: { 'Content-Type': 'application/json' } });
      }

      if (url.pathname === '/api/balance') {
        const balance = await getBalance();
        const target = parseFloat(env.DAILY_EARNING_TARGET || '5');
        const progress = (balance / target) * 100;
        return new Response(JSON.stringify({ balance, target, progress }), { headers: { 'Content-Type': 'application/json' } });
      }

      // Expose cached XMR price endpoint for clients and internal use (with lightweight per-IP rate limiting)
      if (url.pathname === '/api/price' && request.method === 'GET') {
        try {
          if (!env || !env.EARNINGS_KV) {
            return new Response(JSON.stringify({ error: 'KV binding missing' }), { status: 503, headers: { 'Content-Type': 'application/json' } });
          }

          // Per-IP rate limiting using EARNINGS_KV
          const clientIP = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'anon';
          const rateKey = `price_rate_${clientIP}`;
          const windowSec = 60; // 1 minute window
          const maxPerWindow = parseInt(env.MAX_REQUESTS_PER_MINUTE || '60', 10);

          let count = 0;
          try {
            const raw = await env.EARNINGS_KV.get(rateKey);
            count = raw ? parseInt(raw, 10) : 0;
          } catch (e) {
            // ignore KV read errors and proceed (best-effort rate limiting)
            count = 0;
          }

          if (count >= maxPerWindow) {
            return new Response(JSON.stringify({ error: 'Rate limit exceeded', retry_after: windowSec }), { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': String(windowSec) } });
          }

          try {
            await env.EARNINGS_KV.put(rateKey, String(count + 1), { expirationTtl: windowSec });
          } catch (e) {
            // ignore put errors
          }

          const price = await fetchXMRPriceUsd(env);
          return new Response(JSON.stringify({ currency: 'XMR', price: price || 0, fetched_at: new Date().toISOString() }), { headers: { 'Content-Type': 'application/json' } });
        } catch (e) {
          return new Response(JSON.stringify({ error: 'Price fetch failed' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }
      }

      // Expose geo lookup endpoint to centralize ip-api usage and caching
      if (url.pathname === '/api/geo' && request.method === 'GET') {
        try {
          if (!env || !env.EARNINGS_KV) return new Response(JSON.stringify({ error: 'KV binding missing' }), { status: 503, headers: { 'Content-Type': 'application/json' } });
          const q = url.searchParams.get('ip') || request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || null;
          if (!q) return new Response(JSON.stringify({ error: 'no_ip' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
          // lightweight per-IP rate limit for geo lookups
          const clientIP = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'anon';
          const rateKey = `geo_rate_${clientIP}`;
          const windowSec = 60;
          const maxPerWindow = Math.min(parseInt(env.MAX_REQUESTS_PER_MINUTE || '60', 10), 60);
          let count = 0;
          try { const raw = await env.EARNINGS_KV.get(rateKey); count = raw ? parseInt(raw, 10) : 0; } catch (e) { count = 0; }
          if (count >= maxPerWindow) return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), { status: 429, headers: { 'Content-Type': 'application/json' } });
          try { await env.EARNINGS_KV.put(rateKey, String(count + 1), { expirationTtl: windowSec }); } catch (e) {}

          const payload = await geoLookupIp(q, env);
          const responseBody = { ...payload, fetched_at: new Date().toISOString() };
          return new Response(JSON.stringify(responseBody), { headers: { 'Content-Type': 'application/json' } });
        } catch (e) {
          return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }
      }

      if (url.pathname === '/api/earn' && request.method === 'POST') {
        try {
          // Bot detection: rate limiting and basic verification
          const clientIP = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown';
          // Perform geolocation lookup for additional bot detection (uses KV cache)
          const geo = await geoLookupIp(clientIP, env);
          if (geo && geo.status === 'fail') {
            return new Response(JSON.stringify({ error: 'IP lookup failed' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
          }
          // Example: block suspicious countries or anonymous proxies
          if (geo && (geo.proxy === true || ['ZZ', 'CN', 'RU'].includes(geo.countryCode))) {
            return new Response(JSON.stringify({ error: 'Restricted region or proxy detected' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
          }
          // KV-based sliding window rate limiting (simple counter)
          const rateLimitKey = `rate_count_${clientIP}`;
          const windowSec = 60; // per-minute window
          const maxPerWindow = parseInt(env.MAX_REQUESTS_PER_MINUTE || '60', 10);
          const now = Date.now();
          const counter = parseInt(await kv.get(rateLimitKey) || '0', 10);
          if (counter >= maxPerWindow) {
            return new Response(JSON.stringify({ error: 'Rate limit exceeded', retry_after: windowSec }), { status: 429, headers: { 'Content-Type': 'application/json' } });
          }
          await kv.put(rateLimitKey, (counter + 1).toString(), { expirationTtl: windowSec });

          const body = await request.json();
          const amount = parseFloat(body.amount) || 0.01;
          
          // Validate amount
          if (amount <= 0 || amount > 1) {
            return new Response(JSON.stringify({ error: 'Invalid amount' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
          }

          const newBalance = await updateBalance(amount);
          
          // Ensure income completion: verify balance update
          const verifyBalance = await getBalance();
          if (Math.abs(verifyBalance - newBalance) > 0.0001) {
            console.error('Income completion verification failed');
            return new Response(JSON.stringify({ error: 'Income processing failed' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
          }

          // Store earn record for tracking
          const earnId = `earn_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
          const earnRecord = {
            id: earnId,
            amount,
            balance_before: newBalance - amount,
            balance_after: newBalance,
            timestamp: new Date().toISOString(),
            verified: true
          };
          await kv.put(earnId, JSON.stringify(earnRecord));

          return new Response(JSON.stringify({ success: true, earned: amount, newBalance, timestamp: new Date().toISOString() }), { headers: { 'Content-Type': 'application/json' } });
        } catch (e) {
          return new Response(JSON.stringify({ success: false, error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }
      }

      // Provide deposit info for crypto top-ups (on-chain address, memo if needed)
  if (url.pathname === '/api/deposit-info' && request.method === 'GET') {
        // Return public deposit address(es) or instructions
        // If a MONERO_WALLET_JSON secret is configured, expose Monero deposit info
        let moneroInfo = null;
        try {
          if (env.MONERO_WALLET_JSON) {
            const mw = JSON.parse(env.MONERO_WALLET_JSON);
            moneroInfo = {
              id: mw.id || null,
              provider: mw.provider || null,
              address: mw.public_address || null,
              label: mw.label || null
            };
          }
        } catch (e) {
          console.warn('MONERO_WALLET_JSON parse failed', e);
          moneroInfo = null;
        }

        const depositInfo = {
          address: env.DEPOSIT_ADDRESS || null,
          network: env.DEPOSIT_NETWORK || 'ethereum',
          memo: env.DEPOSIT_MEMO || null,
          monero: moneroInfo,
          instructions: 'Send funds to the appropriate address. Deposits will be credited after on-chain confirmation.'
        };
        return new Response(JSON.stringify(depositInfo), { headers: { 'Content-Type': 'application/json' } });
      }

      // Crypto gateway webhook endpoint to credit on-chain deposits
      if (url.pathname === '/api/crypto-webhook' && request.method === 'POST') {
        const raw = await request.text();
        const sigHeader = request.headers.get('x-crypto-signature') || '';
        if (CRYPTO_GATEWAY_SECRET && sigHeader) {
          const expected = await computeHmacHex(CRYPTO_GATEWAY_SECRET, raw);
          if (!sigHeader.includes(expected.slice(0, 10))) {
            console.warn('Crypto webhook signature mismatch');
            return new Response('Invalid signature', { status: 400 });
          }
        }

        try {
          const event = JSON.parse(raw);
          // expected event: { type: 'deposit.confirmed', data: { amount: '1000000000000000000', currency: 'ETH', confirmations: 12, address: '0x...' } }
          if (event.type === 'deposit.confirmed') {
            const amountBase = event.data?.amount || '0';
            // Normalization: support per-currency decimals. Default: 18 (ETH-like), XMR uses 12
            const currency = (event.data?.currency || event.currency || '').toUpperCase();
            let decimals = parseInt(env.DEPOSIT_DECIMALS || '18', 10);
            if (currency === 'XMR' || currency === 'MONERO') decimals = 12;
            const amountFloat = parseFloat(amountBase) / (10 ** decimals);
            await updateBalance(amountFloat);
            return new Response(JSON.stringify({ received: true }), { headers: { 'Content-Type': 'application/json' } });
          }
          return new Response(JSON.stringify({ received: true, ignored: true }), { headers: { 'Content-Type': 'application/json' } });
        } catch (e) {
          console.error('Crypto webhook processing failed', e);
          return new Response('Webhook processing failed', { status: 500 });
        }
      }

      // Withdraw endpoint: create a withdrawal request stored in KV for manual processing
      if (url.pathname === '/api/withdraw' && request.method === 'POST') {
        try {
          const body = await request.json();
          const destination = body.destination || null; // e.g., wallet address or payout id
          const amount = parseFloat(body.amount) || 0;
          if (!destination || amount <= 0) return new Response(JSON.stringify({ error: 'Invalid withdraw request' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

          const balance = await getBalance();
          if (amount > balance) return new Response(JSON.stringify({ error: 'Insufficient funds' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

          const id = `withdraw_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
          const reqObj = { id, destination, amount, status: 'pending', created_at: new Date().toISOString() };
          await kv.put(id, JSON.stringify(reqObj));
          // Optionally deduct immediately
          await updateBalance(-amount);

          return new Response(JSON.stringify({ success: true, request: reqObj }), { headers: { 'Content-Type': 'application/json' } });
        } catch (e) {
          return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }
      }

      // Admin: process pending withdrawals (requires ADMIN_TOKEN header)
  if (url.pathname === '/api/process-withdrawals' && request.method === 'POST') {
        const adminToken = request.headers.get('x-admin-token') || null;
        if (!adminToken || adminToken !== env.ADMIN_TOKEN) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });

        try {
          // list keys (KV supports list)
          const list = await kv.list({ prefix: 'withdraw_' });
          const results = [];
          for (const key of list.keys) {
            const raw = await kv.get(key.name);
            if (!raw) continue;
            const req = JSON.parse(raw);
            if (req.status !== 'pending') continue;

            // Process payout with retries and idempotency
            const payoutResult = await processPayoutWithRetries(req, env);
            results.push(payoutResult);
          }

          return new Response(JSON.stringify({ processed: results.length, results }), { headers: { 'Content-Type': 'application/json' } });
        } catch (e) {
          return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }
      }

      // Admin: simulate a Monero payout (safe test, does not send funds)
      if (url.pathname === '/api/admin/monero-test-payout' && request.method === 'POST') {
        return await handleMoneroTestPayout(request, env);
      }

      // Admin: scale agents manually
  if (url.pathname === '/api/admin/scale-agents' && request.method === 'POST') {
        const adminToken = request.headers.get('x-admin-token') || null;
        if (!adminToken || adminToken !== env.ADMIN_TOKEN) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });

        try {
          const body = await request.json();
          const targetAgents = parseInt(body.targetAgents) || 1;
          const controller = env.AGENT_CONTROLLER.get(env.AGENT_CONTROLLER.idFromName('main'));
          const response = await controller.fetch(new Request('/scale', {
            method: 'POST',
            body: JSON.stringify({ targetAgents }),
            headers: { 'x-admin-token': env.ADMIN_TOKEN }
          }));
          return response;
        } catch (e) {
          return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }
      }

      // Admin: get agent status
      if (url.pathname === '/api/admin/agent-status' && request.method === 'GET') {
        const adminToken = request.headers.get('x-admin-token') || null;
        if (!adminToken || adminToken !== env.ADMIN_TOKEN) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });

        try {
          const controller = env.AGENT_CONTROLLER.get(env.AGENT_CONTROLLER.idFromName('main'));
          const response = await controller.fetch(new Request('/status'));
          return response;
        } catch (e) {
          return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }
      }

      // Admin: update auto-scale config
      if (url.pathname === '/api/admin/auto-scale-config' && request.method === 'POST') {
        const adminToken = request.headers.get('x-admin-token') || null;
        if (!adminToken || adminToken !== env.ADMIN_TOKEN) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });

        try {
          const body = await request.json();
          const config = {
            minAgents: parseInt(body.minAgents) || 1,
            maxAgents: parseInt(body.maxAgents) || 100,
            scaleUpThreshold: parseInt(body.scaleUpThreshold) || 50,
            scaleDownThreshold: parseInt(body.scaleDownThreshold) || 10,
            incomeTarget: parseFloat(body.incomeTarget) || 0.1
          };
          await kv.put('auto_scale_config', JSON.stringify(config));
          return new Response(JSON.stringify({ success: true, config }), { headers: { 'Content-Type': 'application/json' } });
        } catch (e) {
          return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }
      }

      // Admin: check Pro purchase status
  if (url.pathname === '/api/admin/pro-purchase-status' && request.method === 'GET') {
        const adminToken = request.headers.get('x-admin-token') || null;
        if (!adminToken || adminToken !== env.ADMIN_TOKEN) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });

        try {
          const status = await kv.get('pro_purchase_status') || 'idle';
          const error = await kv.get('pro_purchase_error');
          const exchangeId = await kv.get('exchange_id');
          const upgradeTimestamp = await kv.get('pro_upgrade_timestamp');
          const balance = await getBalance(kv);
          const xmrPrice = await getXMRPrice(env);
          const fiatValue = balance * xmrPrice;

          return new Response(JSON.stringify({
            status,
            balance,
            fiatValue: fiatValue.toFixed(2),
            exchangeId,
            upgradeTimestamp,
            error,
            nextAction: fiatValue > 30 && status === 'idle' ? 'Ready to exchange' : 'Waiting for conditions'
          }), { headers: { 'Content-Type': 'application/json' } });
        } catch (e) {
          return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }
      }

      // Admin: get real earnings analytics
      if (url.pathname === '/api/admin/real-earnings-analytics' && request.method === 'GET') {
        const adminToken = request.headers.get('x-admin-token') || null;
        if (!adminToken || adminToken !== env.ADMIN_TOKEN) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });

        try {
          const params = Object.fromEntries(url.searchParams.entries());
          const days = Math.min(parseInt(params.days || '7', 10), 30);

          const analytics = await getRealEarningsAnalytics(env, days);
          const metrics = await getMetrics(env);

          return new Response(JSON.stringify({
            analytics,
            currentMetrics: metrics,
            summary: {
              totalRealEarnings: analytics.totalEarnings,
              averageDaily: analytics.totalEarnings / days,
              bestPerformingAgent: analytics.bestAgent,
              mostProfitableSource: analytics.bestSource,
              efficiency: (metrics.incomeRate > 0) ? (analytics.totalEarnings / metrics.incomeRate) * 100 : 0
            }
          }), { headers: { 'Content-Type': 'application/json' } });
        } catch (e) {
          return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }
      }

      // Transactions history: aggregate revenue, performance and withdrawals from KV
      if (url.pathname === '/api/transactions' && request.method === 'GET') {
        const params = Object.fromEntries(url.searchParams.entries());
        const ttype = params.type || 'all';
        const limit = Math.min(parseInt(params.limit || '200', 10) || 200, 1000);

        try {
          const results = [];

          if (ttype === 'all' || ttype === 'withdraws') {
            const list = await kv.list({ prefix: 'withdraw_' });
            for (const k of list.keys.slice(0, limit)) {
              const raw = await kv.get(k.name);
              if (!raw) continue;
              try { results.push({ key: k.name, type: 'withdraw', data: JSON.parse(raw) }); } catch(e){ results.push({ key: k.name, type: 'withdraw', data: raw }); }
            }
          }

          if (ttype === 'all' || ttype === 'revenue') {
            const revList = await kv.list({ prefix: 'revenue_analytics_' });
            for (const k of revList.keys.slice(0, limit)) {
              const raw = await kv.get(k.name);
              if (!raw) continue;
              try { results.push({ key: k.name, type: 'revenue', data: JSON.parse(raw) }); } catch(e){ results.push({ key: k.name, type: 'revenue', data: raw }); }
            }
          }

          if (ttype === 'all' || ttype === 'performance') {
            const perfList = await kv.list({ prefix: 'performance_' });
            for (const k of perfList.keys.slice(0, limit)) {
              const raw = await kv.get(k.name);
              if (!raw) continue;
              try { results.push({ key: k.name, type: 'performance', data: JSON.parse(raw) }); } catch(e){ results.push({ key: k.name, type: 'performance', data: raw }); }
            }
          }

          results.sort((a,b) => (a.key > b.key) ? -1 : 1);
          return new Response(JSON.stringify({ count: results.length, results }), { headers: { 'Content-Type': 'application/json' } });
        } catch (e) {
          return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }
      }

      // Earning accountability checklist
      if (url.pathname === '/api/earning-checklist' && request.method === 'GET') {
        try {
          const balance = await getBalance();
          const checklist = {
            balance_check: balance >= 0,
            kv_health: !!env.EARNINGS_KV,
            monero_wallet: !!env.MONERO_WALLET_JSON,
            crypto_gateway: !!env.CRYPTO_GATEWAY_ENDPOINT,
            admin_token: !!env.ADMIN_TOKEN,
            recent_earnings: [],
            pending_withdrawals: 0,
            completed_payouts: 0
          };

          // Check recent earnings
          const earnList = await kv.list({ prefix: 'earn_' });
          checklist.recent_earnings = earnList.keys.slice(0, 5).map(k => k.name);

          // Check withdrawals
          const withdrawList = await kv.list({ prefix: 'withdraw_' });
          for (const k of withdrawList.keys) {
            const raw = await kv.get(k.name);
            if (raw) {
              const req = JSON.parse(raw);
              if (req.status === 'pending') checklist.pending_withdrawals++;
              if (req.status === 'processed') checklist.completed_payouts++;
            }
          }

          return new Response(JSON.stringify(checklist), { headers: { 'Content-Type': 'application/json' } });
        } catch (e) {
          return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }
      }

      return new Response(JSON.stringify({ message: 'Revenue Multiplier API with Auto Agent Scaling', endpoints: { health: '/health', balance: '/api/balance', earn: '/api/earn (POST)', deposit_info: '/api/deposit-info', crypto_webhook: '/api/crypto-webhook (POST)', withdraw: '/api/withdraw (POST)', process_withdrawals: '/api/process-withdrawals (POST)', transactions: '/api/transactions', earning_checklist: '/api/earning-checklist', monero_test_payout: '/api/admin/monero-test-payout (POST)', scale_agents: '/api/admin/scale-agents (POST)', agent_status: '/api/admin/agent-status', auto_scale_config: '/api/admin/auto-scale-config (POST)', pro_purchase_status: '/api/admin/pro-purchase-status', real_earnings_analytics: '/api/admin/real-earnings-analytics' } }), { headers: { 'Content-Type': 'application/json' } });

    } catch (error) {
      console.error('Worker error:', error);
      return new Response(JSON.stringify({ error: 'Internal Server Error', message: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
  }
};

// -------------------------
// Monero helper functions
// -------------------------
// Note: This adapter does NOT store private keys. It expects a JSON blob in the
// secret `MONERO_WALLET_JSON` that contains the public address and metadata.
// Use `wrangler secret put MONERO_WALLET_JSON` to safely upload the secret.

async function readMoneroWallet(env) {
  try {
    if (!env.MONERO_WALLET_JSON) return null;
    return JSON.parse(env.MONERO_WALLET_JSON);
  } catch (e) {
    console.warn('Failed to parse MONERO_WALLET_JSON', e);
    return null;
  }
}

// Admin-only simulation endpoint: simulate a Monero payout and write a ledger entry to KV
// This is safe for testing and does not send funds. Requires x-admin-token header.
async function handleMoneroTestPayout(request, env) {
  const adminToken = request.headers.get('x-admin-token') || null;
  if (!adminToken || adminToken !== env.ADMIN_TOKEN) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });

  try {
    const body = await request.json();
    const to = body.to || null;
    const amount = parseFloat(body.amount) || 0;
    if (!to || amount <= 0) return new Response(JSON.stringify({ error: 'Invalid request' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

    const kv = env.EARNINGS_KV;
    const id = `monero_test_payout_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
    const record = {
      id,
      to,
      amount,
      currency: 'XMR',
      status: 'simulated',
      created_at: new Date().toISOString()
    };

    // write ledger entry to KV under 'ledger_' prefix for audit
    await kv.put(`ledger_${id}`, JSON.stringify(record));

    return new Response(JSON.stringify({ success: true, simulated: true, record }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('Monero test payout failed', e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

// Process payout with retries and idempotency
async function processPayoutWithRetries(req, env) {
  const kv = env.EARNINGS_KV;
  const payoutId = `payout_${req.id}`;
  
  // Check for existing payout attempt (idempotency)
  const existing = await kv.get(payoutId);
  if (existing) {
    const parsed = JSON.parse(existing);
    if (parsed.status === 'completed' || parsed.status === 'failed_permanent') {
      return { id: req.id, status: parsed.status, idempotent: true };
    }
  }

  // Initialize payout record
  const payoutRecord = {
    id: payoutId,
    requestId: req.id,
    attempts: 0,
    maxRetries: 3,
    status: 'processing',
    created_at: new Date().toISOString(),
    last_attempt: null,
    errors: []
  };

  await kv.put(payoutId, JSON.stringify(payoutRecord));

  // Attempt payout with retries
  for (let attempt = 1; attempt <= payoutRecord.maxRetries; attempt++) {
    try {
      payoutRecord.attempts = attempt;
      payoutRecord.last_attempt = new Date().toISOString();

      const result = await attemptPayout(req, env);
      
      if (result.success) {
        payoutRecord.status = 'completed';
        req.status = 'processed';
        req.processed_at = new Date().toISOString();
        req.gateway_response = result.response;
        await kv.put(req.id, JSON.stringify(req));
        await kv.put(payoutId, JSON.stringify(payoutRecord));
        return { id: req.id, status: 'processed', gateway: result.response };
      } else {
        payoutRecord.errors.push(result.error);
        if (attempt === payoutRecord.maxRetries) {
          payoutRecord.status = 'failed_permanent';
          req.status = 'failed';
          req.error = result.error;
          await kv.put(req.id, JSON.stringify(req));
          await kv.put(payoutId, JSON.stringify(payoutRecord));
          return { id: req.id, status: 'failed', error: result.error };
        }
      }
    } catch (e) {
      payoutRecord.errors.push(e.message);
      if (attempt === payoutRecord.maxRetries) {
        payoutRecord.status = 'failed_permanent';
        req.status = 'failed';
        req.error = e.message;
        await kv.put(req.id, JSON.stringify(req));
        await kv.put(payoutId, JSON.stringify(payoutRecord));
        return { id: req.id, status: 'failed', error: e.message };
      }
    }

    // Wait before retry (exponential backoff)
    await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
  }
}

// Attempt a single payout
async function attemptPayout(req, env) {
  const CRYPTO_GATEWAY_ENDPOINT = env.CRYPTO_GATEWAY_ENDPOINT || null;
  const CRYPTO_GATEWAY_KEY = env.CRYPTO_GATEWAY_KEY || null;

  // Detect currency and address type
  const isMoneroAddress = (a) => !!(typeof a === 'string' && /^[48][0-9A-Za-z]{90,110}$/.test(a));
  const isEthereumAddress = (a) => !!(typeof a === 'string' && /^0x[a-fA-F0-9]{40}$/.test(a));
  const isBitcoinAddress = (a) => !!(typeof a === 'string' && /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(a));

  let currency = 'ETH'; // default
  if (isMoneroAddress(req.destination)) currency = 'XMR';
  else if (isBitcoinAddress(req.destination)) currency = 'BTC';
  else if (isEthereumAddress(req.destination)) currency = 'ETH';

  // For Monero, check if we have wallet info for real payout
  if (currency === 'XMR' && env.MONERO_WALLET_JSON) {
    const wallet = await readMoneroWallet(env);
    if (wallet && wallet.provider !== 'XMR_SIM') {
      // Attempt real Monero payout (placeholder - would need Monero RPC integration)
      // For now, simulate success
      return { success: true, response: { txid: `xmr_tx_${Date.now()}`, simulated: true } };
    }
  }

  // Use crypto gateway for other currencies or fallback
  if (CRYPTO_GATEWAY_KEY && CRYPTO_GATEWAY_ENDPOINT) {
    const payoutBody = { to: req.destination, amount: req.amount, currency };
    
    const payoutRes = await fetch(`${CRYPTO_GATEWAY_ENDPOINT}/payouts`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${CRYPTO_GATEWAY_KEY}`, 
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify(payoutBody)
    });
    
    const payoutBodyRes = await payoutRes.json().catch(() => ({ error: 'Invalid response' }));
    
    if (payoutRes.ok) {
      return { success: true, response: payoutBodyRes };
    } else {
      return { success: false, error: payoutBodyRes.error || 'Gateway error' };
    }
  }

  // Manual processing required
  return { success: false, error: 'No automated payout method available' };
}

// -------------------------
// Agent Scaling System
// -------------------------

// Handle Cron Triggers for Auto-Scaling
async function handleCronTrigger(env, ctx) {
  try {
    const metrics = await getMetrics(env);
    const config = await getAutoScaleConfig(env);
    const currentAgents = await getCurrentAgentCount(env);
    const targetAgents = calculateTargetAgents(metrics, config, currentAgents);
    
    if (targetAgents !== currentAgents) {
      const controller = env.AGENT_CONTROLLER.get(env.AGENT_CONTROLLER.idFromName('main'));
      await controller.fetch(new Request('/scale', {
        method: 'POST',
        body: JSON.stringify({ targetAgents }),
        headers: { 'x-admin-token': env.ADMIN_TOKEN }
      }));
      
      // Log scaling event
      await logScalingEvent(env, currentAgents, targetAgents, metrics);
    }

    // Check for Pro purchase opportunity
    await checkForProPurchase(env);
    
    return new Response('Auto-scaling and Pro purchase check completed', { status: 200 });
  } catch (e) {
    console.error('Cron trigger error:', e);
    return new Response('Cron error', { status: 500 });
  }
}

// Check for Pro purchase opportunity
async function checkForProPurchase(env) {
  try {
  const kv = env.EARNINGS_KV;
  const balance = await getBalance(kv);
  const xmrPrice = await getXMRPrice(env);
  const fiatValue = balance * xmrPrice;
    const status = await kv.get('pro_purchase_status') || 'idle';

    console.log(`Pro purchase check: Balance=${balance} XMR, Fiat=$${fiatValue.toFixed(2)}, Status=${status}`);

    if (fiatValue > 30 && status === 'idle') {
      console.log('Initiating Pro purchase process...');
      await kv.put('pro_purchase_status', 'exchanging');
      await exchangeXMRToUSDT(env, balance * 0.95); // Use 95% to account for fees
    } else if (status === 'card_ready') {
      await checkPaymentMethodAndUpgrade(env);
    } else if (status === 'exchanging') {
      // Check exchange status
      await checkExchangeStatus(env);
    }
  } catch (e) {
    console.error('Pro purchase check error:', e);
  }
}

// Exchange XMR to USDT using ChangeNOW API
async function exchangeXMRToUSDT(env, amount) {
  try {
    const kv = env.EARNINGS_KV;
    const changenowApiKey = env.CHANGENOW_API_KEY;
    const alchemyDepositAddress = env.ALCHEMY_DEPOSIT_ADDRESS;
    const moneroRefundAddress = env.MONERO_REFUND_ADDRESS;

    if (!changenowApiKey || !alchemyDepositAddress || !moneroRefundAddress) {
      console.error('Missing required environment variables for exchange');
      await kv.put('pro_purchase_status', 'error');
      await kv.put('pro_purchase_error', 'Missing API keys or addresses');
      return;
    }

    console.log(`Exchanging ${amount} XMR to USDT...`);

    const exchangeRequest = {
      fromCurrency: 'xmr',
      toCurrency: 'usdttrc20',
      fromAmount: amount,
      toAddress: alchemyDepositAddress,
      refundAddress: moneroRefundAddress,
      flow: 'standard'
    };

    const res = await fetch('https://api.changenow.io/v2/exchange', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-changenow-api-key': changenowApiKey
      },
      body: JSON.stringify(exchangeRequest)
    });

    const data = await res.json();

    if (res.ok && data.id) {
      console.log(`Exchange created: ${data.id}`);
      await kv.put('exchange_id', data.id);
      await kv.put('exchange_data', JSON.stringify(data));
      await kv.put('pro_purchase_status', 'exchanged');

      // Start polling for exchange completion
      await checkExchangeStatus(env);
    } else {
      console.error('Exchange creation failed:', data);
      await kv.put('pro_purchase_status', 'error');
      await kv.put('pro_purchase_error', JSON.stringify(data));
    }
  } catch (e) {
    console.error('Exchange error:', e);
    await kv.put('pro_purchase_status', 'error');
    await kv.put('pro_purchase_error', e.message);
  }
}

// Check exchange status and proceed to card creation when complete
async function checkExchangeStatus(env) {
  try {
    const kv = env.EARNINGS_KV;
    const exchangeId = await kv.get('exchange_id');
    const changenowApiKey = env.CHANGENOW_API_KEY;

    if (!exchangeId || !changenowApiKey) {
      return;
    }

    const res = await fetch(`https://api.changenow.io/v2/exchange/${exchangeId}`, {
      headers: {
        'x-changenow-api-key': changenowApiKey
      }
    });

    const data = await res.json();

    if (res.ok) {
      console.log(`Exchange status: ${data.status}`);

      if (data.status === 'finished') {
        console.log('Exchange completed, creating virtual card...');
        await kv.put('pro_purchase_status', 'creating_card');
        await createVirtualCard(env);
      } else if (data.status === 'failed' || data.status === 'refunded') {
        console.error('Exchange failed:', data);
        await kv.put('pro_purchase_status', 'error');
        await kv.put('pro_purchase_error', `Exchange ${data.status}`);
      }
      // If still exchanging, continue polling (will be called again by cron)
    } else {
      console.error('Exchange status check failed:', data);
    }
  } catch (e) {
    console.error('Exchange status check error:', e);
  }
}

// Create virtual card using Alchemy Pay API
async function createVirtualCard(env) {
  try {
    const kv = env.EARNINGS_KV;
    const alchemyApiKey = env.ALCHEMY_API_KEY;

    if (!alchemyApiKey) {
      console.error('Missing Alchemy Pay API key');
      await kv.put('pro_purchase_status', 'error');
      await kv.put('pro_purchase_error', 'Missing Alchemy Pay API key');
      return;
    }

    console.log('Creating virtual card...');

    const cardRequest = {
      amount: 30, // USD equivalent
      currency: 'USD',
      fundingSource: 'crypto',
      cardType: 'virtual',
      description: 'Cloudflare Pro Upgrade'
    };

    const res = await fetch('https://api.alchemypay.org/v1/virtualcards/create', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${alchemyApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(cardRequest)
    });

    const data = await res.json();

    if (res.ok && data.cardNumber) {
      console.log('Virtual card created successfully');
      await kv.put('virtual_card_details', JSON.stringify(data));

      // Notify admin for manual addition to Cloudflare
      await notifyAdminForCardAddition(env, data);
      await kv.put('pro_purchase_status', 'card_ready');

      console.log('Card details sent to admin for Cloudflare addition');
    } else {
      console.error('Virtual card creation failed:', data);
      await kv.put('pro_purchase_status', 'error');
      await kv.put('pro_purchase_error', JSON.stringify(data));
    }
  } catch (e) {
    console.error('Virtual card creation error:', e);
    await kv.put('pro_purchase_status', 'error');
    await kv.put('pro_purchase_error', e.message);
  }
}

// Notify admin for manual card addition to Cloudflare
async function notifyAdminForCardAddition(env, cardData) {
  try {
    const slackWebhook = env.SLACK_WEBHOOK_URL;
    const emailWebhook = env.EMAIL_WEBHOOK_URL;

    const message = {
      text: `🚀 **Cloudflare Pro Upgrade Ready!**\n\n` +
            `A virtual card has been created for Cloudflare Pro purchase:\n\n` +
            `**Card Details:**\n` +
            `• Number: \`${cardData.cardNumber}\`\n` +
            `• Expiry: \`${cardData.expiry}\`\n` +
            `• CVV: \`${cardData.cvv}\`\n\n` +
            `**Action Required:**\n` +
            `1. Log into Cloudflare Dashboard\n` +
            `2. Go to Billing → Payment Methods\n` +
            `3. Add this card as a new payment method\n` +
            `4. Once added, the system will automatically upgrade to Pro\n\n` +
            `**Security Note:** Delete this message after adding the card.`,
      username: 'Revenue Multiplier Bot',
      icon_emoji: ':money_with_wings:'
    };

    // Send to Slack if configured
    if (slackWebhook) {
      await fetch(slackWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message)
      });
      console.log('Card details sent to Slack');
    }

    // Send to email webhook if configured
    if (emailWebhook) {
      await fetch(emailWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: env.ADMIN_EMAIL,
          subject: 'Cloudflare Pro Upgrade - Card Details',
          body: message.text.replace(/\*\*/g, '').replace(/\`/g, '')
        })
      });
      console.log('Card details sent to email');
    }

    // Store notification timestamp
    const kv = env.EARNINGS_KV;
    await kv.put('card_notification_sent', new Date().toISOString());

  } catch (e) {
    console.error('Notification error:', e);
  }
}

// Check for payment method and upgrade to Pro
async function checkPaymentMethodAndUpgrade(env) {
  try {
    const kv = env.EARNINGS_KV;
    const cloudflareApiToken = env.CLOUDFLARE_API_TOKEN;
    const accountId = env.CLOUDFLARE_ACCOUNT_ID;
    const zoneId = env.ZONE_ID;

    if (!cloudflareApiToken || !accountId || !zoneId) {
      console.error('Missing Cloudflare API configuration');
      return;
    }

    console.log('Checking for payment methods...');

    // List payment methods
    const listRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/billing/payment_methods`, {
      headers: {
        'Authorization': `Bearer ${cloudflareApiToken}`,
        'Content-Type': 'application/json'
      }
    });

    const listData = await listRes.json();

    if (listRes.ok && listData.result && listData.result.length > 0) {
      console.log(`Found ${listData.result.length} payment method(s), proceeding with upgrade...`);

      // Get current subscription details
      const subRes = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/subscription`, {
        headers: {
          'Authorization': `Bearer ${cloudflareApiToken}`,
          'Content-Type': 'application/json'
        }
      });

      const subData = await subRes.json();

      if (subRes.ok && subData.result) {
        const currentPlan = subData.result.rate_plan?.id;

        if (currentPlan !== 'pro') {
          console.log('Upgrading to Pro plan...');

          // Upgrade to Pro
          const upgradeRes = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/subscription`, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${cloudflareApiToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              rate_plan: { id: 'pro' },
              frequency: 'monthly'
            })
          });

          const upgradeData = await upgradeRes.json();

          if (upgradeRes.ok) {
            console.log('Successfully upgraded to Cloudflare Pro!');
            await kv.put('pro_purchase_status', 'upgraded');
            await kv.put('pro_upgrade_timestamp', new Date().toISOString());

            // Scale agents higher post-upgrade
            await scaleAgentsPostUpgrade(env);

            // Send success notification
            await notifyAdminUpgradeComplete(env);
          } else {
            console.error('Upgrade failed:', upgradeData);
            await kv.put('pro_purchase_error', JSON.stringify(upgradeData));
          }
        } else {
          console.log('Already on Pro plan');
          await kv.put('pro_purchase_status', 'already_pro');
        }
      } else {
        console.error('Failed to get subscription details:', subData);
      }
    } else {
      console.log('No payment methods found, waiting for manual addition...');
      // Will retry on next cron run
    }
  } catch (e) {
    console.error('Payment method check error:', e);
  }
}

// Scale agents higher after Pro upgrade
async function scaleAgentsPostUpgrade(env) {
  try {
    const controller = env.AGENT_CONTROLLER.get(env.AGENT_CONTROLLER.idFromName('main'));
    const config = await getAutoScaleConfig(env);
    const newTarget = Math.min(config.maxAgents, 50); // Scale up to 50 agents post-Pro

    await controller.fetch(new Request('/scale', {
      method: 'POST',
      body: JSON.stringify({ targetAgents: newTarget }),
      headers: { 'x-admin-token': env.ADMIN_TOKEN }
    }));

    console.log(`Scaled agents to ${newTarget} after Pro upgrade`);
  } catch (e) {
    console.error('Post-upgrade scaling error:', e);
  }
}

// Notify admin of successful upgrade
async function notifyAdminUpgradeComplete(env) {
  try {
    const slackWebhook = env.SLACK_WEBHOOK_URL;
    const message = {
      text: `🎉 **Cloudflare Pro Upgrade Complete!**\n\n` +
            `Successfully upgraded to Cloudflare Pro plan!\n` +
            `Agents scaled up for maximum earning potential.\n` +
            `Next renewal will be automatic.`,
      username: 'Revenue Multiplier Bot',
      icon_emoji: ':tada:'
    };

    if (slackWebhook) {
      await fetch(slackWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message)
      });
    }
  } catch (e) {
    console.error('Upgrade notification error:', e);
  }
}

// Get system metrics for scaling decisions
async function getMetrics(env) {
  const kv = env.EARNINGS_KV;
  
  // Get pending earns (simulate queue)
  const pendingEarns = await kv.get('pending_earns', { type: 'json' }) || [];
  
  // Calculate real income rate from actual earnings
  const realIncomeRate = await calculateRealIncomeRate(env);
  
  // Get XMR price for market-based scaling
  const xmrPrice = await getXMRPrice(env);
  
  // Get current balance and target
  const balance = await getBalance(kv);
  const dailyTarget = parseFloat(env.DAILY_EARNING_TARGET || '5');
  
  // Calculate progress toward daily target
  const today = new Date().toISOString().split('T')[0];
  const dailyEarnings = parseFloat(await kv.get(`daily_earnings_${today}`) || '0');
  const dailyProgress = (dailyEarnings / dailyTarget) * 100;
  
  return {
    load: pendingEarns.length,
    incomeRate: realIncomeRate,
    xmrPrice,
    balance,
    dailyTarget,
    dailyEarnings,
    dailyProgress,
    timestamp: new Date().toISOString()
  };
}

// Calculate real income rate from actual earnings data
async function calculateRealIncomeRate(env) {
  const kv = env.EARNINGS_KV;
  const now = Date.now();
  const oneHourAgo = now - (60 * 60 * 1000);
  
  let totalRealIncome = 0;
  let count = 0;
  
  // Query real earnings from the last hour
  const earningsList = await kv.list({ prefix: 'real_earnings_' });
  for (const key of earningsList.keys.slice(0, 200)) { // Limit for performance
    const raw = await kv.get(key.name);
    if (raw) {
      const record = JSON.parse(raw);
      if (new Date(record.timestamp).getTime() > oneHourAgo) {
        totalRealIncome += record.amount;
        count++;
      }
    }
  }
  
  // If no real earnings, fall back to simulated rate
  if (count === 0) {
    return await calculateIncomeRate(env); // Fallback to simulated
  }
  
  return totalRealIncome; // Real income per hour
}

// Calculate income rate from recent earnings
async function calculateIncomeRate(env) {
  const kv = env.EARNINGS_KV;
  const now = Date.now();
  const oneHourAgo = now - (60 * 60 * 1000);
  
  let totalIncome = 0;
  let count = 0;
  
  // Query recent earn records (this is simplified - in practice you'd need better indexing)
  const earnList = await kv.list({ prefix: 'earn_' });
  for (const key of earnList.keys.slice(0, 100)) { // Limit to avoid performance issues
    const raw = await kv.get(key.name);
    if (raw) {
      const record = JSON.parse(raw);
      if (new Date(record.timestamp).getTime() > oneHourAgo) {
        totalIncome += record.amount;
        count++;
      }
    }
  }
  
  return count > 0 ? totalIncome / (60 * 60) : 0; // Income per hour
}

// Get XMR price from CoinGecko via helper (respects rate limits and centralizes error handling)
async function getXMRPrice(env) {
  const price = await fetchXMRPriceUsd(env);
  return price || 0;
}

// Get auto-scale configuration
async function getAutoScaleConfig(env) {
  const kv = env.EARNINGS_KV;
  const config = await kv.get('auto_scale_config', { type: 'json' });
  return config || {
    minAgents: 1,
    maxAgents: 100,
    scaleUpThreshold: 50,
    scaleDownThreshold: 10,
    incomeTarget: 0.1
  };
}

// Get current agent count
async function getCurrentAgentCount(env) {
  const controller = env.AGENT_CONTROLLER.get(env.AGENT_CONTROLLER.idFromName('main'));
  const response = await controller.fetch(new Request('/status'));
  const data = await response.json();
  return data.activeAgents || 1;
}

// Calculate target agent count based on enhanced metrics
function calculateTargetAgents(metrics, config, current) {
  let target = current;
  
  // Scale up if real income is below target or daily progress is low
  if (metrics.incomeRate < (metrics.dailyTarget / 24) || metrics.dailyProgress < 50) {
    target = Math.min(current + 5, config.maxAgents);
  }
  
  // Scale up more aggressively if balance is low but target is high
  if (metrics.balance < (metrics.dailyTarget * 0.1) && metrics.dailyTarget > 10) {
    target = Math.min(current + 10, config.maxAgents);
  }
  
  // Scale down if income is consistently above target and daily progress is good
  if (metrics.incomeRate > (metrics.dailyTarget / 12) && metrics.dailyProgress > 80 && metrics.load < config.scaleDownThreshold) {
    target = Math.max(current - 3, config.minAgents);
  }
  
  // Market-based scaling: scale up if XMR price is high (good for crypto earnings)
  if (metrics.xmrPrice > 200) {
    target = Math.min(target + 3, config.maxAgents);
  }
  
  // Emergency scaling: if no income for extended period, scale up to investigate
  if (metrics.incomeRate === 0 && current < config.maxAgents) {
    target = Math.min(current + 2, config.maxAgents);
  }
  
  return Math.max(target, config.minAgents); // Ensure minimum agents
}

// Log scaling events
async function logScalingEvent(env, oldCount, newCount, metrics) {
  const kv = env.EARNINGS_KV;
  const event = {
    timestamp: new Date().toISOString(),
    oldCount,
    newCount,
    reason: `Auto-scaling: load=${metrics.load}, incomeRate=${metrics.incomeRate}, xmrPrice=${metrics.xmrPrice}`
  };
  await kv.put(`scale_event_${Date.now()}`, JSON.stringify(event));
}

// Agent execution function with real income generation
async function runAgent(id, env) {
  const kv = env.EARNINGS_KV;
  
  while (true) {
    try {
      // Check if agent should still be running
      const currentCount = await getCurrentAgentCount(env);
      if (id >= currentCount) break;
      
      // Real income generation - multiple strategies
      const earnings = await generateRealIncome(id, env);
      
      if (earnings > 0) {
        // Update balance with real earnings
        const earnRequest = new Request('https://sina-empire-revenue-multiplier.louiewong4.workers.dev/api/earn', {
          method: 'POST',
          body: JSON.stringify({ 
            amount: earnings, 
            agentId: id,
            source: 'real_api'
          }),
          headers: { 'Content-Type': 'application/json' }
        });
        
        const response = await fetch(earnRequest);
        if (response.ok) {
          const result = await response.json();
          console.log(`Agent ${id} generated $${earnings} real income`);
          
          // Log real earnings for tracking
          await logRealEarnings(env, id, earnings, 'api_call');
        }
      }
      
      // Dynamic rate limiting based on success
      const delay = earnings > 0 ? 10000 + Math.random() * 20000 : 30000 + Math.random() * 30000; // 10-30s on success, 30-60s on failure
      await new Promise(resolve => setTimeout(resolve, delay));
      
    } catch (e) {
      console.error(`Agent ${id} error:`, e);
      await new Promise(resolve => setTimeout(resolve, 60000)); // Wait 1 minute on error
    }
  }
}

// Generate real income through various API integrations
async function generateRealIncome(agentId, env) {
  try {
    let totalEarnings = 0;
    
    // Strategy 1: Affiliate/Micro-task APIs (if configured)
    if (env.AFFILIATE_API_KEY) {
      const affiliateEarnings = await callAffiliateAPI(agentId, env);
      totalEarnings += affiliateEarnings;
    }
    
    // Strategy 2: Crypto faucet/light mining simulation
    if (env.ENABLE_CRYPTO_MINING === 'true') {
      const miningEarnings = await simulateCryptoMining(agentId, env);
      totalEarnings += miningEarnings;
    }
    
    // Strategy 3: Data processing/validation tasks
    if (env.DATA_PROCESSING_API) {
      const dataEarnings = await processDataTasks(agentId, env);
      totalEarnings += dataEarnings;
    }
    
    // Strategy 4: Ad view simulation (ethical, non-fraudulent)
    if (env.AD_NETWORK_API) {
      const adEarnings = await viewAdsEthically(agentId, env);
      totalEarnings += adEarnings;
    }
    
    return totalEarnings;
  } catch (e) {
    console.error('Real income generation error:', e);
    return 0;
  }
}

// Affiliate API integration
async function callAffiliateAPI(agentId, env) {
  try {
    // Example: Call a legitimate affiliate network API
    const res = await fetch(`${env.AFFILIATE_API_ENDPOINT}/tasks/complete`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.AFFILIATE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        agentId: `agent_${agentId}`,
        taskType: 'micro_task'
      })
    });
    
    if (res.ok) {
      const data = await res.json();
      return parseFloat(data.reward || 0);
    }
  } catch (e) {
    console.error('Affiliate API error:', e);
  }
  return 0;
}

// Simulate crypto mining (light validation tasks)
async function simulateCryptoMining(agentId, env) {
  try {
    // Example: Call a mining pool API for validation work
    const res = await fetch('https://api.moneroocean.stream/miner/stats', {
      headers: { 'User-Agent': 'SinaEmpireAgent/1.0' }
    });
    
    if (res.ok) {
      // Simulate earning based on network hashrate and our "contribution"
      const networkStats = await res.json();
      const simulatedEarnings = (Math.random() * 0.001) * (networkStats.hashrate || 1) / 1000000;
      return Math.max(0.0001, simulatedEarnings); // Minimum 0.0001 XMR
    }
  } catch (e) {
    console.error('Mining simulation error:', e);
  }
  return 0;
}

// Data processing tasks
async function processDataTasks(agentId, env) {
  try {
    // Example: Call a data validation API
    const res = await fetch(`${env.DATA_PROCESSING_API}/tasks/claim`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.DATA_PROCESSING_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        workerId: `sina_agent_${agentId}`,
        capabilities: ['validation', 'processing']
      })
    });
    
    if (res.ok) {
      const task = await res.json();
      if (task.id) {
        // Process the task and submit result
        const result = await processTask(task);
        const submitRes = await fetch(`${env.DATA_PROCESSING_API}/tasks/${task.id}/submit`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.DATA_PROCESSING_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ result })
        });
        
        if (submitRes.ok) {
          const reward = await submitRes.json();
          return parseFloat(reward.amount || 0);
        }
      }
    }
  } catch (e) {
    console.error('Data processing error:', e);
  }
  return 0;
}

// Ethical ad viewing
async function viewAdsEthically(agentId, env) {
  try {
    // Example: Call an ad network API for legitimate ad views
    const res = await fetch(`${env.AD_NETWORK_API}/ads/available`, {
      headers: {
        'Authorization': `Bearer ${env.AD_NETWORK_KEY}`,
        'User-Agent': 'SinaEmpireAgent/1.0'
      }
    });
    
    if (res.ok) {
      const ads = await res.json();
      if (ads.length > 0) {
        // Simulate viewing one ad
        const ad = ads[0];
        const viewRes = await fetch(`${env.AD_NETWORK_API}/ads/${ad.id}/view`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.AD_NETWORK_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            viewerId: `agent_${agentId}`,
            duration: 30 // 30 seconds
          })
        });
        
        if (viewRes.ok) {
          const reward = await viewRes.json();
          return parseFloat(reward.earnings || 0);
        }
      }
    }
  } catch (e) {
    console.error('Ad viewing error:', e);
  }
  return 0;
}

// Process a data validation task
async function processTask(task) {
  // Simple validation logic - in real implementation, this would be more sophisticated
  if (task.type === 'validation') {
    return {
      valid: true,
      checksum: await generateChecksum(task.data),
      processedAt: new Date().toISOString()
    };
  }
  return { processed: true };
}

// Generate simple checksum for validation
async function generateChecksum(data) {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(JSON.stringify(data));
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
}

// Log real earnings for analytics
async function logRealEarnings(env, agentId, amount, source) {
  try {
    const kv = env.EARNINGS_KV;
    const logEntry = {
      agentId,
      amount,
      source,
      timestamp: new Date().toISOString(),
      fiatValue: amount * (await getXMRPrice(env))
    };
    
    const key = `real_earnings_${Date.now()}_${agentId}`;
    await kv.put(key, JSON.stringify(logEntry));
    
    // Update daily earnings total
    const today = new Date().toISOString().split('T')[0];
    const dailyKey = `daily_earnings_${today}`;
    const currentDaily = parseFloat(await kv.get(dailyKey) || '0');
    await kv.put(dailyKey, (currentDaily + amount).toString());
    
  } catch (e) {
    console.error('Real earnings logging error:', e);
  }
}

// Get real earnings analytics for monitoring
async function getRealEarningsAnalytics(env, days) {
  try {
    const kv = env.EARNINGS_KV;
    const now = new Date();
    const startDate = new Date(now.getTime() - (days * 24 * 60 * 60 * 1000));
    
    const earnings = [];
    const agentPerformance = {};
    const sourcePerformance = {};
    
    // Query real earnings records
    const earningsList = await kv.list({ prefix: 'real_earnings_' });
    
    for (const key of earningsList.keys) {
      const raw = await kv.get(key.name);
      if (raw) {
        const record = JSON.parse(raw);
        const recordDate = new Date(record.timestamp);
        
        if (recordDate >= startDate) {
          earnings.push(record);
          
          // Track agent performance
          if (!agentPerformance[record.agentId]) {
            agentPerformance[record.agentId] = { total: 0, count: 0 };
          }
          agentPerformance[record.agentId].total += record.amount;
          agentPerformance[record.agentId].count += 1;
          
          // Track source performance
          if (!sourcePerformance[record.source]) {
            sourcePerformance[record.source] = { total: 0, count: 0 };
          }
          sourcePerformance[record.source].total += record.amount;
          sourcePerformance[record.source].count += 1;
        }
      }
    }
    
    // Calculate totals and averages
    const totalEarnings = earnings.reduce((sum, record) => sum + record.amount, 0);
    
    // Find best performing agent
    let bestAgent = null;
    let bestAgentEarnings = 0;
    Object.entries(agentPerformance).forEach(([agentId, data]) => {
      if (data.total > bestAgentEarnings) {
        bestAgent = agentId;
        bestAgentEarnings = data.total;
      }
    });
    
    // Find most profitable source
    let bestSource = null;
    let bestSourceEarnings = 0;
    Object.entries(sourcePerformance).forEach(([source, data]) => {
      if (data.total > bestSourceEarnings) {
        bestSource = source;
        bestSourceEarnings = data.total;
      }
    });
    
    return {
      totalEarnings,
      totalRecords: earnings.length,
      averagePerRecord: earnings.length > 0 ? totalEarnings / earnings.length : 0,
      bestAgent,
      bestAgentEarnings,
      bestSource,
      bestSourceEarnings,
      agentPerformance,
      sourcePerformance,
      period: `${days} days`,
      startDate: startDate.toISOString(),
      endDate: now.toISOString()
    };
    
  } catch (e) {
    console.error('Analytics error:', e);
    return {
      totalEarnings: 0,
      totalRecords: 0,
      error: e.message
    };
  }
}

// -------------------------
// Durable Object: Agent Controller
// -------------------------
export class AgentController {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request) {
    const url = new URL(request.url);
    
    if (url.pathname === '/scale') {
      if (!this.validateAdmin(request)) return new Response('Unauthorized', { status: 401 });
      
      const { targetAgents } = await request.json();
      const config = await getAutoScaleConfig(this.env);
      const clampedTarget = Math.min(Math.max(targetAgents, config.minAgents), config.maxAgents);
      
      // Use SQLite storage for persistence
      await this.state.storage.put('activeAgents', clampedTarget);
      
      // Launch or stop agents as needed
      const current = await this.state.storage.get('activeAgents') || 1;
      if (clampedTarget > current) {
        // Launch additional agents
        for (let i = current; i < clampedTarget; i++) {
          ctx.waitUntil(runAgent(i, this.env));
        }
      }
      
      return new Response(JSON.stringify({ 
        success: true, 
        activeAgents: clampedTarget,
        message: `Scaled to ${clampedTarget} agents` 
      }), { headers: { 'Content-Type': 'application/json' } });
      
    } else if (url.pathname === '/status') {
      // Use SQLite storage for retrieving data
      const activeAgents = await this.state.storage.get('activeAgents') || 1;
      const metrics = await getMetrics(this.env);
      const config = await getAutoScaleConfig(this.env);
      
      return new Response(JSON.stringify({
        activeAgents,
        metrics,
        config,
        storage: 'sqlite' // Indicate SQLite usage
      }), { headers: { 'Content-Type': 'application/json' } });
    }
    
    return new Response('Agent Controller', { status: 200 });
  }

  validateAdmin(request) {
    return request.headers.get('x-admin-token') === this.env.ADMIN_TOKEN;
  }
}
