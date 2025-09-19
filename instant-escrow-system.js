#!/usr/bin/env node
// instant-escrow-system.js - Micro/mid-tier escrow service
// Port 3500 - Handles escrow contracts for micro-offers and mid-tier services

const express = require('express');
const app = express();
const PORT = process.env.PORT || 3500;

app.use(express.json());

// Simple in-memory escrow storage (use DB in production)
const escrows = new Map();

app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'instant-escrow-micro',
    port: PORT,
    timestamp: new Date().toISOString()
  });
});

app.get('/escrows', (req, res) => {
  res.json({
    total: escrows.size,
    escrows: Array.from(escrows.values())
  });
});

app.post('/escrow/create', (req, res) => {
  const { amount, description, client, freelancer } = req.body;
  const escrowId = `esc_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
  
  const escrow = {
    id: escrowId,
    amount,
    description,
    client,
    freelancer,
    status: 'pending_payment',
    created: new Date().toISOString()
  };
  
  escrows.set(escrowId, escrow);
  
  res.json({
    success: true,
    escrowId,
    escrow,
    message: 'Escrow created - waiting for payment'
  });
});

app.listen(PORT, () => {
  console.log(`🔒 Instant Escrow (Micro) running on port ${PORT}`);
});