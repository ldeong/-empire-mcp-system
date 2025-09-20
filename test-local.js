import { serve } from '@hono/node-server';
import app from './src/income-empire.js';

// Simple environment simulation for local testing
const env = {
  KV: {
    get: async (key) => {
      // Simulate KV storage
      const storage = global.kvStorage || {};
      return storage[key] || null;
    },
    put: async (key, value) => {
      if (!global.kvStorage) global.kvStorage = {};
      global.kvStorage[key] = value;
    }
  },
  DB: {
    prepare: (sql) => ({
      bind: (...args) => ({
        run: async () => ({ success: true }),
        first: async () => ({ count: 0 })
      })
    })
  }
};

// Wrap the app to inject environment
const wrappedApp = (req, res) => {
  req.env = env;
  return app(req, res);
};

console.log('🚀 Starting SINA Empire Income System...');
console.log('💰 Dashboard: http://localhost:3000');
console.log('📊 API: http://localhost:3000/api/stats');

serve({
  fetch: wrappedApp,
  port: 3000
});
