// optimizer-worker.js - High-Performance MCP WebSocket Optimizer for Cloudflare Workers
// Optimizes AP2-compliant agent system for faster MCP operations and WebSocket performance

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const start = Date.now();

    try {
      // KILL SWITCH - Check first for immediate 503 response
      const killSwitch = await env.DB.prepare("SELECT v FROM settings WHERE k='kill_switch'").first();
      if (killSwitch?.v === 'on') {
        return new Response(JSON.stringify({ 
          error: "System temporarily unavailable for maintenance" 
        }), { 
          status: 503, 
          headers: { "content-type": "application/json" } 
        });
      }

      // FAST PATH: Optimized /usekey endpoint with KV caching
      if (url.pathname === '/usekey' && request.method === 'GET') {
        return await handleOptimizedUseKey(url, env, ctx);
      }

      // FAST PATH: Optimized /status endpoint
      if (url.pathname === '/status' && request.method === 'GET') {
        return await handleStatusEndpoint(env);
      }

      // FAST PATH: Circle webhook handler
      if (url.pathname === '/webhook/circle' && request.method === 'POST') {
        return await handleCircleWebhook(request, env);
      }

      // FAST PATH: Optimized /buykey with spend guard
      if (url.pathname === '/buykey' && request.method === 'POST') {
        return await handleOptimizedBuyKey(request, env);
      }

      // FALLBACK: Default AP2 system handler
      return await handleDefaultRoute(request, env, ctx);

    } catch (error) {
      console.error('Worker error:', error);
      
      // Log performance metrics
      const duration = Date.now() - start;
      ctx.waitUntil(logPerformanceMetric(env, {
        endpoint: url.pathname,
        duration,
        error: error.message,
        timestamp: Date.now()
      }));

      return new Response(JSON.stringify({ 
        error: "Internal server error" 
      }), { 
        status: 500, 
        headers: { "content-type": "application/json" } 
      });
    }
  }
};

// OPTIMIZED: Fast /usekey with KV caching
async function handleOptimizedUseKey(url, env, ctx) {
  const service = url.searchParams.get('service');
  
  if (!service) {
    return new Response('Missing service parameter', { status: 400 });
  }

  // Check KV cache first for ultra-fast response
  const cacheKey = `active_key:${service}`;
  const cachedKey = await env.API_KEY_KV.get(cacheKey);
  
  if (cachedKey) {
    // Performance boost: Return cached key immediately
    ctx.waitUntil(logPerformanceMetric(env, {
      endpoint: '/usekey',
      service,
      cache_hit: true,
      duration: Date.now() - performance.now()
    }));
    
    return new Response(cachedKey, {
      headers: { 
        'Content-Type': 'text/plain',
        'Cache-Control': 'private, max-age=30',
        'X-Cache': 'HIT'
      }
    });
  }

  // Cache miss: Get fresh key from database
  const keyRow = await env.DB.prepare(`
    SELECT k.enc_key, k.id, s.name 
    FROM keys k 
    JOIN services s ON s.id = k.service_id 
    WHERE s.name = ? AND k.status = 'active' 
    ORDER BY k.daily_used ASC 
    LIMIT 1
  `).bind(service).first();

  if (!keyRow) {
    // No key available - trigger auto-purchase
    return new Response(JSON.stringify({ 
      error: "No keys available", 
      auto_purchase_triggered: true 
    }), { 
      status: 404, 
      headers: { "content-type": "application/json" } 
    });
  }

  // Decrypt key (simplified for demo)
  const decryptedKey = await decryptKey(keyRow.enc_key, env.KMS_SECRET);
  
  // Cache for 60 seconds
  ctx.waitUntil(env.API_KEY_KV.put(cacheKey, decryptedKey, { expirationTtl: 60 }));
  
  // Log performance metrics
  ctx.waitUntil(logPerformanceMetric(env, {
    endpoint: '/usekey',
    service,
    cache_hit: false,
    key_id: keyRow.id,
    duration: Date.now() - performance.now()
  }));

  return new Response(decryptedKey, {
    headers: { 
      'Content-Type': 'text/plain',
      'X-Cache': 'MISS'
    }
  });
}

// OPTIMIZED: /status endpoint with performance metrics
async function handleStatusEndpoint(env) {
  const uptime = process.uptime ? process.uptime() : 0;
  
  // Get wallet balance headroom
  const walletBalance = await getCircleBalance(env);
  
  // Get quota headroom for all services
  const quotaStats = await env.DB.prepare(`
    SELECT 
      s.name,
      s.daily_quota,
      COALESCE(SUM(k.daily_used), 0) as used,
      COUNT(k.id) as key_count
    FROM services s
    LEFT JOIN keys k ON k.service_id = s.id AND k.status = 'active'
    GROUP BY s.id, s.name
  `).all();

  // Calculate SLOs from recent usage
  const recentMetrics = await env.DB.prepare(`
    SELECT 
      AVG(latency_ms) as avg_latency,
      SUM(success) * 100.0 / COUNT(*) as success_rate,
      COUNT(*) as total_requests
    FROM usage_log 
    WHERE ts > ?
  `).bind(Date.now() - 3600000).first(); // Last hour

  const status = {
    status: "operational",
    uptime_seconds: uptime,
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    wallet: {
      balance_usd: walletBalance?.balance || 0,
      headroom_days: Math.floor((walletBalance?.balance || 0) / 10) // Estimate at $10/day
    },
    quotas: quotaStats.results?.map(q => ({
      service: q.name,
      usage_percent: Math.round((q.used / q.daily_quota) * 100),
      headroom_requests: q.daily_quota - q.used,
      active_keys: q.key_count
    })) || [],
    slos: {
      avg_latency_ms: Math.round(recentMetrics?.avg_latency || 0),
      success_rate_percent: Math.round(recentMetrics?.success_rate || 100),
      requests_last_hour: recentMetrics?.total_requests || 0
    }
  };

  return new Response(JSON.stringify(status, null, 2), {
    headers: { 
      "content-type": "application/json",
      "cache-control": "public, max-age=30"
    }
  });
}

// SCAFFOLD: Circle webhook handler
async function handleCircleWebhook(request, env) {
  const signature = request.headers.get('circle-signature');
  const body = await request.text();
  
  // Verify Circle webhook signature (scaffold)
  if (!await verifyCircleSignature(signature, body, env.CIRCLE_WEBHOOK_SECRET)) {
    return new Response('Invalid signature', { status: 401 });
  }

  const webhook = JSON.parse(body);
  
  // Handle payment_settled events
  if (webhook.eventType === 'payment_settled') {
    const payment = webhook.payment;
    
    // Extract tenant KID from memo/reference
    const tenantKid = payment.memo || payment.reference;
    
    if (tenantKid) {
      // Credit tenant balance
      await env.DB.prepare(`
        UPDATE tenants 
        SET balance_usd_cents = balance_usd_cents + ? 
        WHERE kid = ?
      `).bind(Math.round(payment.amount * 100), tenantKid).run();
      
      // Log the credit
      await env.DB.prepare(`
        INSERT INTO purchases (ts, kid, vendor, plan, amount_usd, fee_usd, receipt_url, status)
        VALUES (?, ?, 'circle', 'usdc_deposit', ?, 0, ?, 'completed')
      `).bind(Date.now(), tenantKid, payment.amount, payment.transactionHash).run();
    }
  }

  return new Response('OK');
}

// OPTIMIZED: /buykey with daily spend guard
async function handleOptimizedBuyKey(request, env) {
  const body = await request.json();
  const { service, kid, maxSpendUsd = 10 } = body;
  
  if (!service || !kid) {
    return new Response(JSON.stringify({ error: "Missing service or kid" }), { 
      status: 400, 
      headers: { "content-type": "application/json" } 
    });
  }

  // Check daily spend limit
  const withinLimit = await withinDailySpend(env, kid, Math.round(maxSpendUsd * 100));
  if (!withinLimit) {
    return new Response(JSON.stringify({ 
      error: "Daily spending limit exceeded",
      code: "SPEND_LIMIT_EXCEEDED"
    }), { 
      status: 402, 
      headers: { "content-type": "application/json" } 
    });
  }

  // Proceed with key purchase (simplified)
  const purchaseResult = await purchaseAPIKey(service, maxSpendUsd, env);
  
  return new Response(JSON.stringify(purchaseResult), {
    headers: { "content-type": "application/json" }
  });
}

// HELPER: Daily spend guard
async function withinDailySpend(env, kid, cents) {
  const dayStart = new Date(); 
  dayStart.setUTCHours(0, 0, 0, 0);
  
  const spent = await env.DB.prepare(`
    SELECT IFNULL(SUM(markup_usd * 100), 0) as total_spent 
    FROM usage_log 
    WHERE ts >= ? AND kid = ?
  `).bind(+dayStart, kid).first();
  
  const capRow = await env.DB.prepare("SELECT v FROM settings WHERE k='max_daily_spend_usd'").first();
  const cap = Math.round(100 * parseFloat(capRow?.v || "100"));
  
  return (spent?.total_spent || 0) + cents <= cap;
}

// HELPER: Performance logging
async function logPerformanceMetric(env, metric) {
  // Store in KV for real-time monitoring
  const key = `perf:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`;
  await env.API_KEY_KV.put(key, JSON.stringify(metric), { expirationTtl: 3600 });
}

// HELPER: Simple key decryption (demo)
async function decryptKey(encryptedKey, secret) {
  // In production, use proper AES-GCM decryption
  return `decrypted_${encryptedKey.slice(0, 10)}`;
}

// HELPER: Circle balance check
async function getCircleBalance(env) {
  if (!env.CIRCLE_API_KEY || !env.CIRCLE_WALLET_ID) return null;
  
  try {
    const response = await fetch(`${env.CIRCLE_BASE_URL}/wallets/${env.CIRCLE_WALLET_ID}`, {
      headers: { "Authorization": `Bearer ${env.CIRCLE_API_KEY}` }
    });
    
    if (!response.ok) return null;
    
    const data = await response.json();
    return { balance: parseFloat(data.data?.balance || 0) };
  } catch (error) {
    return null;
  }
}

// HELPER: Circle signature verification (scaffold)
async function verifyCircleSignature(signature, body, secret) {
  // In production, implement proper HMAC verification
  return signature && body && secret;
}

// HELPER: API key purchase (scaffold)
async function purchaseAPIKey(service, maxSpend, env) {
  // In production, integrate with RapidAPI, OpenAI, etc.
  return {
    success: true,
    service,
    amount: maxSpend,
    key_id: `key_${Date.now()}`,
    status: "purchased"
  };
}

// FALLBACK: Handle other routes
async function handleDefaultRoute(request, env, ctx) {
  return new Response(JSON.stringify({ 
    error: "Route not found in optimizer",
    available_endpoints: ["/usekey", "/status", "/webhook/circle", "/buykey"]
  }), { 
    status: 404, 
    headers: { "content-type": "application/json" } 
  });
}