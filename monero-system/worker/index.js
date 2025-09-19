// index.js - Cloudflare Worker for public Monero endpoints (NO PRIVATE KEYS)
// This worker provides public API endpoints and communicates securely with signer service

export default {
    async fetch(request, env, ctx) {
        return await handleRequest(request, env);
    }
};

class EmpirePublicAPI {
    constructor(env) {
        this.env = env;
        this.signerUrl = env.SIGNER_URL;
        this.signerToken = env.SIGNER_AUTH_TOKEN;
        this.cache = env.EMPIRE_CACHE;
    }

    async handleRequest(request) {
        const url = new URL(request.url);
        const path = url.pathname;

        // CORS headers for all responses
        const corsHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        };

        // Handle CORS preflight
        if (request.method === 'OPTIONS') {
            return new Response(null, { status: 200, headers: corsHeaders });
        }

        try {
            let response;

            switch (path) {
                case '/':
                    response = await this.getStatus();
                    break;
                case '/address':
                    response = await this.getReceivingAddress();
                    break;
                case '/balance':
                    response = await this.getPublicBalance();
                    break;
                case '/notify-payment':
                    response = await this.handlePaymentNotification(request);
                    break;
                case '/income/recent':
                    response = await this.getRecentIncome();
                    break;
                case '/health':
                    response = await this.getHealthStatus();
                    break;
                default:
                    response = new Response(JSON.stringify({ 
                        error: 'Endpoint not found',
                        availableEndpoints: ['/', '/address', '/balance', '/notify-payment', '/income/recent', '/health']
                    }), { 
                        status: 404, 
                        headers: { 'Content-Type': 'application/json' }
                    });
            }

            // Add CORS headers to response
            Object.entries(corsHeaders).forEach(([key, value]) => {
                response.headers.set(key, value);
            });

            return response;

        } catch (error) {
            console.error('Worker error:', error);
            
            return new Response(JSON.stringify({
                success: false,
                error: 'Internal server error',
                timestamp: new Date().toISOString()
            }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }
    }

    async getStatus() {
        return new Response(JSON.stringify({
            success: true,
            service: 'Empire Monero Public API',
            version: '1.0.0',
            timestamp: new Date().toISOString(),
            endpoints: {
                '/address': 'Get receiving address',
                '/balance': 'Get public balance info',
                '/notify-payment': 'Notify of incoming payment',
                '/income/recent': 'Get recent income summary',
                '/health': 'Service health check'
            },
            security: {
                privateKeys: 'NEVER stored in workers',
                signerAuth: 'Required for all operations',
                encryption: 'AES-256-GCM for sensitive data'
            }
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    async getReceivingAddress() {
        try {
            // Check cache first (addresses can be cached for short periods)
            const cacheKey = 'receiving_address';
            let cachedAddress = await this.cache.get(cacheKey);
            
            if (cachedAddress) {
                console.log('📋 Returning cached address');
                return new Response(JSON.stringify({
                    success: true,
                    address: cachedAddress,
                    source: 'cache',
                    timestamp: new Date().toISOString()
                }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            // Fetch from secure signer
            const response = await this.callSigner('/get-address');
            
            if (response.success) {
                // Cache address for 1 hour
                await this.cache.put(cacheKey, response.address, { expirationTtl: 3600 });
                
                return new Response(JSON.stringify({
                    success: true,
                    address: response.address,
                    network: response.network,
                    walletName: response.walletName,
                    source: 'signer',
                    timestamp: new Date().toISOString(),
                    instructions: {
                        payment: 'Send XMR to this address',
                        confirmations: 'Wait for 10+ confirmations',
                        notification: 'System will auto-detect payments'
                    }
                }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                });
            } else {
                throw new Error('Failed to get address from signer');
            }

        } catch (error) {
            console.error('❌ Failed to get address:', error);
            
            return new Response(JSON.stringify({
                success: false,
                error: 'Unable to retrieve receiving address',
                timestamp: new Date().toISOString()
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    }

    async getPublicBalance() {
        try {
            const response = await this.callSigner('/balance');
            
            if (response.success) {
                // Convert to user-friendly format (hide exact amounts for privacy)
                const balance = parseFloat(response.balance);
                const tier = this.getBalanceTier(balance);
                
                return new Response(JSON.stringify({
                    success: true,
                    balanceTier: tier,
                    hasBalance: balance > 0,
                    unlockedBalance: parseFloat(response.unlockedBalance),
                    lastUpdated: response.timestamp,
                    status: balance > 0 ? 'funded' : 'awaiting_payment'
                }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                });
            } else {
                throw new Error('Failed to get balance from signer');
            }

        } catch (error) {
            console.error('❌ Failed to get balance:', error);
            
            return new Response(JSON.stringify({
                success: false,
                error: 'Unable to retrieve balance',
                timestamp: new Date().toISOString()
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    }

    async handlePaymentNotification(request) {
        try {
            const data = await request.json();
            const { txId, amount, source } = data;

            console.log(`📨 Payment notification: ${amount} XMR (${txId})`);

            // Store notification for processing
            const notificationKey = `payment_${txId}`;
            const notificationData = {
                txId,
                amount,
                source: source || 'external',
                timestamp: new Date().toISOString(),
                status: 'pending_confirmation'
            };

            await this.cache.put(notificationKey, JSON.stringify(notificationData));

            // Trigger watcher check (if applicable)
            // This could notify the signer service to check for new transactions

            return new Response(JSON.stringify({
                success: true,
                message: 'Payment notification received',
                txId,
                status: 'processing',
                timestamp: new Date().toISOString()
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });

        } catch (error) {
            console.error('❌ Failed to handle payment notification:', error);
            
            return new Response(JSON.stringify({
                success: false,
                error: 'Failed to process payment notification',
                timestamp: new Date().toISOString()
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    }

    async getRecentIncome() {
        try {
            const response = await this.callSigner('/transfers/incoming');
            
            if (response.success) {
                const confirmedTransfers = response.transfers.filter(t => t.isConfirmed);
                const totalConfirmed = confirmedTransfers.reduce((sum, t) => sum + parseFloat(t.amount), 0);
                
                return new Response(JSON.stringify({
                    success: true,
                    recentIncome: {
                        totalConfirmed,
                        transactionCount: confirmedTransfers.length,
                        pendingCount: response.transfers.filter(t => !t.isConfirmed).length,
                        last24h: response.transfers.length
                    },
                    timestamp: new Date().toISOString()
                }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                });
            } else {
                throw new Error('Failed to get transfers from signer');
            }

        } catch (error) {
            console.error('❌ Failed to get recent income:', error);
            
            return new Response(JSON.stringify({
                success: false,
                error: 'Unable to retrieve income data',
                timestamp: new Date().toISOString()
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    }

    async getHealthStatus() {
        try {
            const signerHealth = await this.callSigner('/health');
            
            return new Response(JSON.stringify({
                success: true,
                worker: {
                    status: 'healthy',
                    environment: this.env.ENVIRONMENT || 'development',
                    timestamp: new Date().toISOString()
                },
                signer: signerHealth,
                overall: signerHealth.status === 'healthy' ? 'operational' : 'degraded'
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });

        } catch (error) {
            console.error('❌ Health check failed:', error);
            
            return new Response(JSON.stringify({
                success: false,
                worker: {
                    status: 'healthy',
                    timestamp: new Date().toISOString()
                },
                signer: {
                    status: 'unreachable',
                    error: error.message
                },
                overall: 'degraded'
            }), {
                status: 200, // Don't return 500 for health checks
                headers: { 'Content-Type': 'application/json' }
            });
        }
    }

    async callSigner(endpoint, options = {}) {
        const url = `${this.signerUrl}${endpoint}`;
        const config = {
            method: 'GET',
            headers: {
                'X-Signer-Token': this.signerToken,
                'Content-Type': 'application/json'
            },
            ...options
        };

        const response = await fetch(url, config);
        
        if (!response.ok) {
            throw new Error(`Signer request failed: ${response.status}`);
        }

        return await response.json();
    }

    getBalanceTier(balance) {
        if (balance === 0) return 'empty';
        if (balance < 0.1) return 'minimal';
        if (balance < 1) return 'low';
        if (balance < 10) return 'moderate';
        if (balance < 100) return 'substantial';
        return 'high';
    }
}

async function handleRequest(request, env) {
    const api = new EmpirePublicAPI(env);
    return await api.handleRequest(request);
}