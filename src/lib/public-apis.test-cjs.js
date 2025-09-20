// CommonJS test adapter for public-apis helpers
// This file is intended for the Jest test environment and mirrors the
// interface of the ESM `public-apis.js` helpers without using ESM import.

const DEFAULT_PRICE_KEY = 'xmr_price_usd_v1';

async function fetchXMRPriceUsd(env, fetchImpl = global.fetch) {
  // env.EARNINGS_KV is expected to be a KV-like object with get/put
  try {
    const cached = await env.EARNINGS_KV.get(DEFAULT_PRICE_KEY, { type: 'json' });
    const now = Date.now();
    if (cached && cached.price && cached.timestamp && now - cached.timestamp < 1000 * 60 * 5) {
      return cached.price;
    }
  } catch (e) {
    // ignore cache read errors
  }

  // Fetch from CoinGecko
  const res = await fetchImpl('https://api.coingecko.com/api/v3/simple/price?ids=monero&vs_currencies=usd');
  const json = await res.json();
  const price = json && json.monero && json.monero.usd ? json.monero.usd : null;

  if (price != null) {
    try {
      await env.EARNINGS_KV.put(DEFAULT_PRICE_KEY, JSON.stringify({ price, timestamp: Date.now() }), { expirationTtl: 300 });
    } catch (e) {
      // ignore KV write errors in tests
    }
  }
  return price;
}

async function geoLookupIp(ip, env, fetchImpl = global.fetch) {
  const key = `geo_${ip}`;
  try {
    const cached = await env.EARNINGS_KV.get(key, { type: 'json' });
    const now = Date.now();
    if (cached && cached.timestamp && now - cached.timestamp < 24 * 60 * 60 * 1000) {
      return cached;
    }
  } catch (e) {
    // ignore
  }

  const res = await fetchImpl(`http://ip-api.com/json/${ip}`);
  const json = await res.json();
  if (json) {
    try {
      await env.EARNINGS_KV.put(key, JSON.stringify({ ...json, timestamp: Date.now() }), { expirationTtl: 24 * 60 * 60 });
    } catch (e) {
      // ignore
    }
  }
  return json;
}

module.exports = {
  fetchXMRPriceUsd,
  geoLookupIp
};
