// Local Node.js adapter for SINA Empire Income System
import { serve } from '@hono/node-server';

// Simple environment simulation for local testing
const env = {
  KV: {
    get: async (key) => {
      if (!global.kvStorage) global.kvStorage = {};
      return global.kvStorage[key] || null;
    },
    put: async (key, value) => {
      if (!global.kvStorage) global.kvStorage = {};
      global.kvStorage[key] = value;
      return true;
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

// Import the main app
const appModule = await import('./src/income-empire.js');
const app = appModule.default;

console.log('🚀 Starting SINA Empire Income System...');
console.log('💰 Dashboard: http://localhost:3000');
console.log('📊 API Stats: http://localhost:3000/api/stats');
console.log('🧪 Test Services: http://localhost:3000/api/health');
console.log('');
console.log('🎯 READY TO EARN REAL MONEY!');

serve({
  fetch: (req) => app.fetch(req, env),
  port: 3000
});