// Lightweight wrappers for public, no-auth APIs used by the worker
// These helpers accept an `env` object to use `EARNINGS_KV` for caching
// NOTE: This file is the canonical, centralized caller for external
// public APIs (CoinGecko, ip-api). Do not make direct calls to those
// upstreams elsewhere in the codebase — use these helpers or the
// `/api/price` and `/api/geo` endpoints so requests are cached and rate-limited.

export async function fetchXMRPriceUsd(env, fetchImpl = fetch) {
  const cacheKey = 'xmr_price_usd_v1';
  const ttlSeconds = 300; // 5 minutes
  try {
    if (env && env.EARNINGS_KV) {
      const cached = await env.EARNINGS_KV.get(cacheKey, { type: 'json' });
      if (cached && (Date.now() - (cached.timestamp || 0)) < ttlSeconds * 1000) {
        return cached.price;
      }
    }

    const res = await fetchImpl('https://api.coingecko.com/api/v3/simple/price?ids=monero&vs_currencies=usd');
    if (!res.ok) throw new Error('CoinGecko fetch failed');
    const json = await res.json();
    const price = json?.monero?.usd ?? null;

    if (env && env.EARNINGS_KV && price != null) {
      await env.EARNINGS_KV.put(cacheKey, JSON.stringify({ price, timestamp: Date.now() }), { expirationTtl: ttlSeconds });
    }

    return price;
  } catch (e) {
    console.error('fetchXMRPriceUsd error', e);
    try {
      if (env && env.EARNINGS_KV) {
        const cached = await env.EARNINGS_KV.get(cacheKey, { type: 'json' });
        return cached?.price ?? null;
      }
    } catch (ee) {
      console.error('fetchXMRPriceUsd cache fallback error', ee);
    }
    return null;
  }
}

export async function geoLookupIp(ip, env, fetchImpl = fetch) {
  if (!ip) return { status: 'fail', message: 'no_ip' };
  const cacheKey = `geo_${ip}`;
  const ttlSeconds = 24 * 60 * 60; // 24 hours
  try {
    if (env && env.EARNINGS_KV) {
      const cached = await env.EARNINGS_KV.get(cacheKey, { type: 'json' });
      if (cached && (Date.now() - (cached.timestamp || 0)) < ttlSeconds * 1000) {
        return cached;
      }
    }

    const res = await fetchImpl('http://ip-api.com/json/' + encodeURIComponent(ip));
    if (!res.ok) throw new Error('IP API fetch failed');
    const json = await res.json();

    const payload = { ...json, timestamp: Date.now() };
    if (env && env.EARNINGS_KV) {
      await env.EARNINGS_KV.put(cacheKey, JSON.stringify(payload), { expirationTtl: ttlSeconds });
    }

    return payload;
  } catch (e) {
    console.error('geoLookupIp error', e);
    try {
      if (env && env.EARNINGS_KV) {
        const cached = await env.EARNINGS_KV.get(cacheKey, { type: 'json' });
        if (cached) return cached;
      }
    } catch (ee) {
      console.error('geoLookupIp cache fallback error', ee);
    }
    return { status: 'fail', message: e.message };
  }
}

export async function fetchCoinPrices(ids, env, fetchImpl = fetch) {
  if (!ids || (Array.isArray(ids) && ids.length === 0)) return {};
  const idsArray = Array.isArray(ids) ? ids : String(ids).split(',').map(s => s.trim());
  const key = `coin_prices_${idsArray.join(',')}`;
  const ttlSeconds = 300; // 5 minutes
  try {
    if (env && env.EARNINGS_KV) {
      const cached = await env.EARNINGS_KV.get(key, { type: 'json' });
      if (cached && (Date.now() - (cached.timestamp || 0)) < ttlSeconds * 1000) {
        return cached.data;
      }
    }

    const idsParam = idsArray.join(',');
    const url = 'https://api.coingecko.com/api/v3/simple/price?ids=' + encodeURIComponent(idsParam) + '&vs_currencies=usd';
    const res = await fetchImpl(url);
    if (!res.ok) throw new Error('CoinGecko fetch failed');
    const json = await res.json();

    if (env && env.EARNINGS_KV) {
      await env.EARNINGS_KV.put(key, JSON.stringify({ data: json, timestamp: Date.now() }), { expirationTtl: ttlSeconds });
    }

    return json;
  } catch (e) {
    console.error('fetchCoinPrices error', e);
    try {
      if (env && env.EARNINGS_KV) {
        const cached = await env.EARNINGS_KV.get(key, { type: 'json' });
        return cached?.data ?? {};
      }
    } catch (ee) {
      console.error('fetchCoinPrices cache fallback error', ee);
    }
    return {};
  }
}
