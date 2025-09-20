import { describe, it, beforeEach, expect, jest } from '@jest/globals';
import worker from '../src/index.js';

describe('Integration: API Endpoints', () => {
  let mockEnv, controller;

  beforeEach(() => {
    jest.clearAllMocks && jest.clearAllMocks();
    mockEnv = {
      EARNINGS_KV: {
        // default: return null for any key; tests will override with mockImplementation when needed
        get: jest.fn().mockResolvedValue(null),
        put: jest.fn().mockResolvedValue()
      },
      MAX_REQUESTS_PER_MINUTE: 60,
      CLOUDFLARE_PRO_PRICE: 25,
      ORCHESTRATOR_STATE: { put: jest.fn().mockResolvedValue() },
      CASHFLOW_DB: { query: jest.fn().mockResolvedValue() }
    };
    global.fetch = jest.fn();
  // Use the worker's default export (object with fetch) to exercise HTTP routes
  controller = worker;
  });

  it('returns XMR price with caching', async () => {
    // Ensure rate key returns null, and cache key returns the cached price
    mockEnv.EARNINGS_KV.get.mockImplementation(async (key) => {
      if (String(key).startsWith('price_rate_')) return null;
      if (key === 'xmr_price_usd_v1') return { price: 150, timestamp: Date.now() };
      return null;
    });
    const request = new Request('https://example.test/api/price', {
      headers: { 'cf-connecting-ip': '8.8.8.8' }
    });
    const response = await controller.fetch(request, mockEnv);
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.currency).toBe('XMR');
    expect(data.price).toBe(150);
    expect(data.fetched_at).toBeDefined();
  });

  it('fetches XMR price if cache expired', async () => {
    // Rate key null, cache miss -> will call fetch
    mockEnv.EARNINGS_KV.get.mockImplementation(async (key) => {
      if (String(key).startsWith('price_rate_')) return null;
      if (key === 'xmr_price_usd_v1') return null;
      return null;
    });
    global.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ monero: { usd: 152 } }) });
    const request = new Request('https://example.test/api/price', {
      headers: { 'cf-connecting-ip': '8.8.8.8' }
    });
    const response = await controller.fetch(request, mockEnv);
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.currency).toBe('XMR');
    expect(data.price).toBe(152);
    expect(mockEnv.EARNINGS_KV.put).toHaveBeenCalled();
  });

  it('returns 429 on rate limit exceeded for /api/price', async () => {
    // Simulate the rate key returning a count >= maxPerWindow
    mockEnv.EARNINGS_KV.get.mockImplementation(async (key) => {
      if (String(key).startsWith('price_rate_')) return '61';
      return null;
    });
    const request = new Request('https://example.test/api/price', {
      headers: { 'cf-connecting-ip': '8.8.8.8' }
    });
    const response = await controller.fetch(request, mockEnv);
    const data = await response.json();
    expect(response.status).toBe(429);
    expect(data.error).toBe('Rate limit exceeded');
  });

  it('returns geo data with caching', async () => {
    // Ensure rate key returns null and the geo cache contains data
    mockEnv.EARNINGS_KV.get.mockImplementation(async (key) => {
      if (String(key).startsWith('geo_rate_')) return null;
      if (key === 'geo_8.8.8.8') return { status: 'success', countryCode: 'US', timestamp: Date.now() };
      return null;
    });
    const request = new Request('https://example.test/api/geo', {
      headers: { 'cf-connecting-ip': '8.8.8.8' }
    });
    const response = await controller.fetch(request, mockEnv);
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.status).toBe('success');
    expect(data.countryCode).toBe('US');
    expect(data.fetched_at).toBeDefined();
  });

  it('fetches geo data if cache expired', async () => {
    // Rate key null, cache miss -> will call fetch
    mockEnv.EARNINGS_KV.get.mockImplementation(async (key) => {
      if (String(key).startsWith('geo_rate_')) return null;
      if (key === 'geo_8.8.8.8') return null;
      return null;
    });
    global.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'success', countryCode: 'CA' }) });
    const request = new Request('https://example.test/api/geo', {
      headers: { 'cf-connecting-ip': '8.8.8.8' }
    });
    const response = await controller.fetch(request, mockEnv);
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.countryCode).toBe('CA');
    expect(mockEnv.EARNINGS_KV.put).toHaveBeenCalled();
  });

  it('returns 429 on rate limit exceeded for /api/geo', async () => {
    mockEnv.EARNINGS_KV.get.mockImplementation(async (key) => {
      if (String(key).startsWith('geo_rate_')) return '61';
      return null;
    });
    const request = new Request('https://example.test/api/geo', {
      headers: { 'cf-connecting-ip': '8.8.8.8' }
    });
    const response = await controller.fetch(request, mockEnv);
    const data = await response.json();
    expect(response.status).toBe(429);
    expect(data.error).toBe('Rate limit exceeded');
  });

});
