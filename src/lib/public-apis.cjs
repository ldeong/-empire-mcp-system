// CommonJS wrapper used by Jest tests and Node-based tooling.
// Prefer a synchronous require of a test adapter to avoid dynamic import
// issues in Jest. If the adapter isn't present, fall back to a dynamic
// ESM import for runtime environments that support it.
try {
  module.exports = require('./public-apis.test-cjs');
} catch (e) {
  // Fallback dynamic loader: expose async functions that import the ESM module
  async function _load() {
    return await import('./public-apis.js');
  }

  module.exports = {
    fetchXMRPriceUsd: async function(env, fetchImpl) {
      const m = await _load();
      return m.fetchXMRPriceUsd(env, fetchImpl);
    },
    geoLookupIp: async function(ip, env, fetchImpl) {
      const m = await _load();
      return m.geoLookupIp(ip, env, fetchImpl);
    }
  };
}
