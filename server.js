const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
// Serve static PWA files from public/
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.send('SINA Empire CLI + PWA Server Running');
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.post('/mcp/voice', (req, res) => {
  const { command, sessionId } = req.body || {};
  console.log('Voice request', { command, sessionId });
  let response = {};
  if (!command) {
    return res.status(400).json({ error: 'missing command' });
  }
  if (command.toLowerCase().includes('revenue')) {
    response = {
      revenue: {
        api: 0,
        mcp: command.toLowerCase().includes('darren') ? 600 : 0.25,
        fallback: 0
      },
      status: 'success'
    };
  } else if (command.toLowerCase().includes('genealogy')) {
    response = { genealogy: { id: 'test_123', data: 'Family tree processed' }, status: 'success' };
  } else if (command.toLowerCase().includes('empire') || command.toLowerCase().includes('tell me about the empire')) {
    response = {
      empire: 'SINA Empire Infrastructure',
      workers: 12,
      d1_databases: 9,
      kv_namespaces: 19,
      r2_buckets: 5,
      status: 'success'
    };
  } else {
    response = { status: 'error', message: 'Unknown command' };
  }
  res.json({
    status: 'ok',
    command,
    response,
    tts: `Processing ${command} for SINA Empire`
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
