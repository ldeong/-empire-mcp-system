import { fetchXMRPriceUsd, geoLookupIp } from '../src/lib/public-apis.js';
import { jest } from '@jest/globals';

describe('Public API Helpers', () => {
  let mockEnv;
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
    mockEnv = {
      EARNINGS_KV: {
        get: jest.fn().mockResolvedValue(null),
        put: jest.fn().mockResolvedValue()
      },
      CASHFLOW_DB: {
        query: jest.fn().mockResolvedValue()
      },
      MAX_REQUESTS_PER_MINUTE: 60,
      CLOUDFLARE_PRO_PRICE: 25
    };
  });

  it('fetches XMR price with caching', async () => {
    mockEnv.EARNINGS_KV.get.mockResolvedValueOnce({ price: 150, timestamp: Date.now() });
    const price = await fetchXMRPriceUsd(mockEnv, global.fetch);
    expect(price).toBe(150);
    expect(mockEnv.EARNINGS_KV.get).toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('fetches XMR price from CoinGecko if cache expired', async () => {
    global.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ monero: { usd: 152 } }) });
    mockEnv.EARNINGS_KV.get.mockResolvedValueOnce(null);
    const price = await fetchXMRPriceUsd(mockEnv, global.fetch);
    expect(price).toBe(152);
    expect(global.fetch).toHaveBeenCalledWith('https://api.coingecko.com/api/v3/simple/price?ids=monero&vs_currencies=usd');
    expect(mockEnv.EARNINGS_KV.put).toHaveBeenCalled();
  });

  it('checks geolocation with caching', async () => {
    mockEnv.EARNINGS_KV.get.mockResolvedValueOnce({ status: 'success', countryCode: 'US', timestamp: Date.now() });
    const geo = await geoLookupIp('8.8.8.8', mockEnv, global.fetch);
    expect(geo.status).toBe('success');
    expect(geo.countryCode).toBe('US');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('fetches geolocation if cache expired', async () => {
    global.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'success', countryCode: 'CA' }) });
    mockEnv.EARNINGS_KV.get.mockResolvedValueOnce(null);
    const geo = await geoLookupIp('8.8.8.8', mockEnv, global.fetch);
    expect(geo.countryCode).toBe('CA');
    expect(global.fetch).toHaveBeenCalledWith('http://ip-api.com/json/8.8.8.8');
  });
});
 
