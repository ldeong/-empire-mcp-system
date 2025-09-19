#!/usr/bin/env node

import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        port: PORT
    });
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        message: 'SINA Empire - GitHub Codespaces Server Running',
        status: 'online',
        timestamp: new Date().toISOString(),
        endpoints: {
            health: '/health',
            diagnostic: 'Available via bypass at http://localhost:3002/diagnostic'
        }
    });
});

// Diagnostic endpoint (redirects to bypass)
app.post('/diagnostic', (req, res) => {
    res.json({
        status: 'bypassed',
        message: 'This endpoint has been moved to avoid 502 timeout issues',
        bypass_url: 'http://localhost:3002/diagnostic',
        instructions: 'Use the bypass server for diagnostic requests'
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err.message);
    res.status(500).json({
        error: 'Internal Server Error',
        message: err.message,
        timestamp: new Date().toISOString()
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: `Endpoint ${req.method} ${req.path} not found`,
        available_endpoints: ['/health', '/', '/diagnostic'],
        timestamp: new Date().toISOString()
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`✅ SINA Empire Server running on port ${PORT}`);
    console.log(`🔗 Access via: https://shiny-dollop-wr4x565wqv542gx7p-${PORT}.app.github.dev/`);
    console.log(`🏥 Health check: http://localhost:${PORT}/health`);
    console.log(`🔧 Diagnostic bypass: http://localhost:3002/diagnostic`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down server...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Shutting down server...');
    process.exit(0);
});

export default app;