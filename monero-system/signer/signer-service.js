// signer-service.js - Secure API service for Monero operations (NO PRIVATE KEYS IN WORKERS)
require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const monerojs = require('monero-ts');
const { EmpireWalletCreator } = require('./wallet-create');
const { SecureEncryption } = require('./encrypt');

class EmpireSignerService {
    constructor() {
        this.app = express();
        this.port = process.env.SIGNER_PORT || 3001;
        this.allowedIPs = (process.env.ALLOWED_IPS || '127.0.0.1').split(',');
        this.encryption = new SecureEncryption(process.env.SIGNER_AUTH_TOKEN || 'default-token');
        this.walletCreator = new EmpireWalletCreator();
        this.activeWallet = null;
        
        this.setupMiddleware();
        this.setupRoutes();
    }

    setupMiddleware() {
        // Security headers
        this.app.use(helmet());
        
        // IP whitelist middleware
        this.app.use((req, res, next) => {
            const clientIP = req.ip || req.connection.remoteAddress;
            console.log(`📡 Request from IP: ${clientIP}`);
            
            if (!this.allowedIPs.includes('0.0.0.0') && !this.allowedIPs.includes(clientIP)) {
                console.warn(`🚫 Blocked request from unauthorized IP: ${clientIP}`);
                return res.status(403).json({ error: 'IP not authorized' });
            }
            next();
        });

        // Auth token middleware
        this.app.use((req, res, next) => {
            const token = req.headers['x-signer-token'];
            if (!token || token !== process.env.SIGNER_AUTH_TOKEN) {
                console.warn(`🚫 Invalid or missing auth token`);
                return res.status(401).json({ error: 'Invalid authentication' });
            }
            next();
        });

        this.app.use(express.json());
        this.app.use(cors({
            origin: function(origin, callback) {
                // Allow requests from Cloudflare Workers
                if (!origin || origin.includes('workers.dev')) {
                    callback(null, true);
                } else {
                    callback(new Error('CORS not allowed'));
                }
            }
        }));
    }

    setupRoutes() {
        // Health check
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                network: process.env.MONERO_NETWORK || 'stagenet',
                walletLoaded: !!this.activeWallet
            });
        });

        // Get receiving address (public operation)
        this.app.get('/get-address', async (req, res) => {
            try {
                const walletName = req.query.wallet || 'empire-primary';
                const address = await this.walletCreator.getAddress(walletName);
                
                console.log(`📬 Provided address for wallet ${walletName}: ${address}`);
                
                res.json({
                    success: true,
                    address,
                    walletName,
                    network: process.env.MONERO_NETWORK || 'stagenet',
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                console.error('❌ Failed to get address:', error);
                res.status(500).json({ 
                    success: false, 
                    error: 'Failed to retrieve address',
                    details: error.message 
                });
            }
        });

        // Load wallet for operations
        this.app.post('/load-wallet', async (req, res) => {
            try {
                const { walletName = 'empire-primary' } = req.body;
                
                // Load wallet data (encrypted)
                const walletData = await this.walletCreator.loadWallet(walletName);
                
                // Create wallet instance for operations
                this.activeWallet = await monerojs.createWalletFull({
                    networkType: walletData.networkType,
                    mnemonic: walletData.mnemonic,
                    serverUri: walletData.networkType === 'stagenet' ? 
                        'http://stagenet.community.rino.io:38081' : 
                        'http://node.community.rino.io:18081'
                });

                console.log(`✅ Loaded wallet: ${walletName}`);
                
                res.json({
                    success: true,
                    walletName,
                    address: walletData.primaryAddress,
                    network: walletData.networkType,
                    loaded: true
                });
            } catch (error) {
                console.error('❌ Failed to load wallet:', error);
                res.status(500).json({ 
                    success: false, 
                    error: 'Failed to load wallet',
                    details: error.message 
                });
            }
        });

        // Get wallet balance
        this.app.get('/balance', async (req, res) => {
            try {
                if (!this.activeWallet) {
                    return res.status(400).json({ 
                        success: false, 
                        error: 'No wallet loaded' 
                    });
                }

                const balance = await this.activeWallet.getBalance();
                const unlockedBalance = await this.activeWallet.getUnlockedBalance();

                console.log(`💰 Wallet balance: ${balance} XMR (unlocked: ${unlockedBalance})`);

                res.json({
                    success: true,
                    balance: balance.toString(),
                    unlockedBalance: unlockedBalance.toString(),
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                console.error('❌ Failed to get balance:', error);
                res.status(500).json({ 
                    success: false, 
                    error: 'Failed to get balance',
                    details: error.message 
                });
            }
        });

        // Get incoming transfers (for watcher)
        this.app.get('/transfers/incoming', async (req, res) => {
            try {
                if (!this.activeWallet) {
                    return res.status(400).json({ 
                        success: false, 
                        error: 'No wallet loaded' 
                    });
                }

                const transfers = await this.activeWallet.getIncomingTransfers();
                const recent = transfers.filter(t => {
                    const age = Date.now() - (t.getTx().getReceivedTimestamp() * 1000);
                    return age < 24 * 60 * 60 * 1000; // Last 24 hours
                });

                console.log(`📨 Found ${recent.length} recent incoming transfers`);

                res.json({
                    success: true,
                    transfers: recent.map(t => ({
                        txId: t.getTx().getId(),
                        amount: t.getAmount().toString(),
                        confirmations: t.getTx().getNumConfirmations(),
                        timestamp: t.getTx().getReceivedTimestamp(),
                        isConfirmed: t.getTx().getNumConfirmations() >= 10
                    })),
                    count: recent.length
                });
            } catch (error) {
                console.error('❌ Failed to get transfers:', error);
                res.status(500).json({ 
                    success: false, 
                    error: 'Failed to get transfers',
                    details: error.message 
                });
            }
        });

        // Create outgoing transaction (for reinvestment)
        this.app.post('/send', async (req, res) => {
            try {
                if (!this.activeWallet) {
                    return res.status(400).json({ 
                        success: false, 
                        error: 'No wallet loaded' 
                    });
                }

                const { address, amount, reason } = req.body;
                
                if (!address || !amount) {
                    return res.status(400).json({ 
                        success: false, 
                        error: 'Address and amount required' 
                    });
                }

                console.log(`💸 Creating transaction: ${amount} XMR to ${address} (${reason})`);

                const tx = await this.activeWallet.createTx({
                    accountIndex: 0,
                    address,
                    amount: monerojs.BigInteger.parse(amount)
                });

                const result = await this.activeWallet.relayTx(tx);

                console.log(`✅ Transaction sent: ${result.getTxId()}`);

                res.json({
                    success: true,
                    txId: result.getTxId(),
                    amount,
                    address,
                    reason,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                console.error('❌ Failed to send transaction:', error);
                res.status(500).json({ 
                    success: false, 
                    error: 'Failed to send transaction',
                    details: error.message 
                });
            }
        });

        // Emergency wallet closure
        this.app.post('/emergency-close', async (req, res) => {
            try {
                if (this.activeWallet) {
                    await this.activeWallet.close(true);
                    this.activeWallet = null;
                    console.log('🚨 Emergency wallet closure completed');
                }
                
                res.json({
                    success: true,
                    message: 'Wallet closed and secured',
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                console.error('❌ Emergency closure failed:', error);
                res.status(500).json({ 
                    success: false, 
                    error: 'Emergency closure failed',
                    details: error.message 
                });
            }
        });
    }

    async start() {
        try {
            console.log('🚀 Starting Empire Signer Service...');
            console.log(`🔐 Network: ${process.env.MONERO_NETWORK || 'stagenet'}`);
            console.log(`🌐 Allowed IPs: ${this.allowedIPs.join(', ')}`);
            
            this.app.listen(this.port, () => {
                console.log(`✅ Signer service running on port ${this.port}`);
                console.log(`🔒 CRITICAL: Never expose this service to public internet`);
                console.log(`🛡️  Only Cloudflare Workers should access this API`);
            });
        } catch (error) {
            console.error('❌ Failed to start signer service:', error);
            process.exit(1);
        }
    }

    async shutdown() {
        try {
            if (this.activeWallet) {
                await this.activeWallet.close(true);
                console.log('💾 Wallet closed safely');
            }
        } catch (error) {
            console.error('❌ Shutdown error:', error);
        }
    }
}

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down signer service...');
    if (global.signerService) {
        await global.signerService.shutdown();
    }
    process.exit(0);
});

// Start service
if (require.main === module) {
    if (!process.env.WALLET_MASTER_PASSPHRASE) {
        console.error('❌ WALLET_MASTER_PASSPHRASE not set');
        process.exit(1);
    }

    if (!process.env.SIGNER_AUTH_TOKEN) {
        console.error('❌ SIGNER_AUTH_TOKEN not set');
        process.exit(1);
    }

    global.signerService = new EmpireSignerService();
    global.signerService.start();
}

module.exports = { EmpireSignerService };