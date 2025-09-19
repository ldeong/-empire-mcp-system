/**
 * SINA EMPIRE REAL WALLET TRACKER
 * Tracks actual blockchain transactions and balances
 * Integrates with empire master control system
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 200, headers: corsHeaders });
    }

    try {
      switch (path) {
        case '/':
          return handleRoot();
        
        case '/api/wallet/balance':
          return await handleWalletBalance(env);
        
        case '/api/wallet/transactions':
          return await handleTransactions(env);
        
        case '/api/wallet/track':
          return await handleTrackTransaction(request, env);
        
        case '/api/revenue/summary':
          return await handleRevenueSummary(env);
        
        default:
          return new Response('Endpoint not found', { status: 404, headers: corsHeaders });
      }
    } catch (error) {
      return new Response(JSON.stringify({
        error: 'Internal server error',
        message: error.message
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
};

// Root endpoint with system info
function handleRoot() {
  const systemInfo = {
    name: 'SINA Empire Wallet Tracker',
    version: '1.0.0',
    status: 'operational',
    tracked_wallets: {
      BTC: '1QFpfT5PZPjVRG3B4qbVK7Q1R4bGQXyLNV',
      ETH: '0x742F90A3B8c4a6a0f3E9A8D7e5F6C3D8E9F1A2B5',
      XMR: '47s6f3kL9mN8P2qR5tU7vW8xY9zA1b2C3d4E5f6G7h8J9k0L1m2N3o4P5q6R7s8T9u0V1w2X3y4Z5a6B',
      USDT: '0x742F90A3B8c4a6a0f3E9A8D7e5F6C3D8E9F1A2B5'
    },
    features: [
      'Real-time balance tracking',
      'Transaction monitoring',
      'Blockchain verification',
      'Revenue attribution',
      'Multi-wallet support'
    ]
  };

  return new Response(JSON.stringify(systemInfo, null, 2), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
}

// Get wallet balances from blockchain APIs
async function handleWalletBalance(env) {
  const wallets = {
    BTC: '1QFpfT5PZPjVRG3B4qbVK7Q1R4bGQXyLNV',
    ETH: '0x742F90A3B8c4a6a0f3E9A8D7e5F6C3D8E9F1A2B5',
    XMR: '47s6f3kL9mN8P2qR5tU7vW8xY9zA1b2C3d4E5f6G7h8J9k0L1m2N3o4P5q6R7s8T9u0V1w2X3y4Z5a6B',
    USDT: '0x742F90A3B8c4a6a0f3E9A8D7e5F6C3D8E9F1A2B5'
  };

  try {
    // Get BTC balance
    const btcBalance = await getBTCBalance(wallets.BTC);
    
    // Get ETH balance
    const ethBalance = await getETHBalance(wallets.ETH);
    
    // Get USDT balance (ERC-20 token)
    const usdtBalance = await getUSDTBalance(wallets.USDT);
    
    // Monero requires different approach - using view key
    const xmrBalance = await getXMRBalance(wallets.XMR);

    const balances = {
      BTC: {
        address: wallets.BTC,
        balance: btcBalance.balance || 0,
        balance_usd: btcBalance.balance_usd || 0,
        confirmed_balance: btcBalance.confirmed || 0,
        unconfirmed_balance: btcBalance.unconfirmed || 0,
        last_updated: new Date().toISOString()
      },
      ETH: {
        address: wallets.ETH,
        balance: ethBalance.balance || 0,
        balance_usd: ethBalance.balance_usd || 0,
        last_updated: new Date().toISOString()
      },
      USDT: {
        address: wallets.USDT,
        balance: usdtBalance.balance || 0,
        balance_usd: usdtBalance.balance_usd || 0,
        last_updated: new Date().toISOString()
      },
      XMR: {
        address: wallets.XMR,
        balance: xmrBalance.balance || 0,
        balance_usd: xmrBalance.balance_usd || 0,
        last_updated: new Date().toISOString()
      },
      total_usd: (btcBalance.balance_usd || 0) + 
                  (ethBalance.balance_usd || 0) + 
                  (usdtBalance.balance_usd || 0) + 
                  (xmrBalance.balance_usd || 0)
    };

    return new Response(JSON.stringify(balances, null, 2), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });

  } catch (error) {
    console.error('Balance fetch error:', error);
    return new Response(JSON.stringify({
      error: 'Failed to fetch balances',
      message: error.message,
      fallback_data: {
        BTC: { balance: 0, status: 'API unavailable' },
        ETH: { balance: 0, status: 'API unavailable' },
        USDT: { balance: 0, status: 'API unavailable' },
        XMR: { balance: 0, status: 'API unavailable' }
      }
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}

// Get Bitcoin balance using BlockCypher API
async function getBTCBalance(address) {
  try {
    const response = await fetch(`https://api.blockcypher.com/v1/btc/main/addrs/${address}/balance`);
    const data = await response.json();
    
    const balanceBTC = data.balance / 100000000; // Convert satoshis to BTC
    const balanceUSD = balanceBTC * 43250; // Current BTC price
    
    return {
      balance: balanceBTC,
      balance_usd: balanceUSD,
      confirmed: data.balance / 100000000,
      unconfirmed: data.unconfirmed_balance / 100000000
    };
  } catch (error) {
    console.error('BTC balance error:', error);
    return { balance: 0, balance_usd: 0, confirmed: 0, unconfirmed: 0 };
  }
}

// Get Ethereum balance using Etherscan API
async function getETHBalance(address) {
  try {
    // Using free Etherscan API (no key required for basic calls)
    const response = await fetch(`https://api.etherscan.io/api?module=account&action=balance&address=${address}&tag=latest`);
    const data = await response.json();
    
    if (data.status === '1') {
      const balanceETH = parseInt(data.result) / Math.pow(10, 18); // Convert wei to ETH
      const balanceUSD = balanceETH * 2380.50; // Current ETH price
      
      return {
        balance: balanceETH,
        balance_usd: balanceUSD
      };
    }
    
    throw new Error('Etherscan API error');
  } catch (error) {
    console.error('ETH balance error:', error);
    return { balance: 0, balance_usd: 0 };
  }
}

// Get USDT balance (ERC-20 token)
async function getUSDTBalance(address) {
  try {
    // USDT contract address on Ethereum
    const usdtContract = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
    
    const response = await fetch(`https://api.etherscan.io/api?module=account&action=tokenbalance&contractaddress=${usdtContract}&address=${address}&tag=latest`);
    const data = await response.json();
    
    if (data.status === '1') {
      const balanceUSDT = parseInt(data.result) / Math.pow(10, 6); // USDT has 6 decimals
      const balanceUSD = balanceUSDT * 1.00; // USDT is pegged to $1
      
      return {
        balance: balanceUSDT,
        balance_usd: balanceUSD
      };
    }
    
    throw new Error('USDT balance API error');
  } catch (error) {
    console.error('USDT balance error:', error);
    return { balance: 0, balance_usd: 0 };
  }
}

// Get Monero balance (requires view key - placeholder implementation)
async function getXMRBalance(address) {
  try {
    // Monero balance checking requires view key and is more complex
    // For now, return placeholder data
    // In production, integrate with Monero RPC or use a service like MoneroBlocks
    
    return {
      balance: 0, // Requires view key integration
      balance_usd: 0,
      note: 'Monero balance requires view key integration'
    };
  } catch (error) {
    console.error('XMR balance error:', error);
    return { balance: 0, balance_usd: 0 };
  }
}

// Handle transaction tracking
async function handleTransactions(env) {
  try {
    // Get recent transactions for all wallets
    const transactions = {
      BTC: await getBTCTransactions('1QFpfT5PZPjVRG3B4qbVK7Q1R4bGQXyLNV'),
      ETH: await getETHTransactions('0x742F90A3B8c4a6a0f3E9A8D7e5F6C3D8E9F1A2B5'),
      // USDT transactions are ETH-based
      // XMR requires special handling
    };

    return new Response(JSON.stringify(transactions, null, 2), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Failed to fetch transactions',
      message: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}

// Get Bitcoin transactions
async function getBTCTransactions(address) {
  try {
    const response = await fetch(`https://api.blockcypher.com/v1/btc/main/addrs/${address}`);
    const data = await response.json();
    
    return {
      address,
      transaction_count: data.n_tx || 0,
      total_received: (data.total_received || 0) / 100000000,
      total_sent: (data.total_sent || 0) / 100000000,
      final_balance: (data.final_balance || 0) / 100000000
    };
  } catch (error) {
    console.error('BTC transactions error:', error);
    return { address, error: error.message };
  }
}

// Get Ethereum transactions
async function getETHTransactions(address) {
  try {
    const response = await fetch(`https://api.etherscan.io/api?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&sort=desc`);
    const data = await response.json();
    
    if (data.status === '1' && data.result) {
      return {
        address,
        transaction_count: data.result.length,
        recent_transactions: data.result.slice(0, 5).map(tx => ({
          hash: tx.hash,
          from: tx.from,
          to: tx.to,
          value: parseInt(tx.value) / Math.pow(10, 18),
          timestamp: new Date(parseInt(tx.timeStamp) * 1000).toISOString()
        }))
      };
    }
    
    return { address, transaction_count: 0, recent_transactions: [] };
  } catch (error) {
    console.error('ETH transactions error:', error);
    return { address, error: error.message };
  }
}

// Track new transaction
async function handleTrackTransaction(request, env) {
  try {
    const { txid, wallet_address, amount, currency, source_agent } = await request.json();

    // Store transaction in D1 database
    if (env.DB) {
      await env.DB.prepare(`
        INSERT INTO real_transactions (txid, wallet_address, amount, currency, source_agent, status, created_at)
        VALUES (?, ?, ?, ?, ?, 'pending', datetime('now'))
      `).bind(txid, wallet_address, amount, currency, source_agent || 'manual').run();
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Transaction tracked successfully',
      txid,
      status: 'pending'
    }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Failed to track transaction',
      message: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}

// Revenue summary
async function handleRevenueSummary(env) {
  try {
    let confirmedTransactions = 0;
    let totalRevenue = 0;

    // Get confirmed transactions from database
    if (env.DB) {
      const result = await env.DB.prepare(`
        SELECT COUNT(*) as count, SUM(amount) as total 
        FROM real_transactions 
        WHERE status = 'confirmed'
      `).first();
      
      confirmedTransactions = result.count || 0;
      totalRevenue = result.total || 0;
    }

    const summary = {
      real_revenue: {
        confirmed_transactions: confirmedTransactions,
        total_amount: totalRevenue,
        status: totalRevenue > 0 ? 'earning' : 'no_income'
      },
      wallet_balances: 'Use /api/wallet/balance endpoint',
      next_steps: confirmedTransactions === 0 ? [
        'Fix Stripe integration to start earning',
        'Deploy income agents',
        'Activate contract pipeline'
      ] : [
        'Scale successful revenue streams',
        'Optimize payment flows',
        'Expand wallet integrations'
      ]
    };

    return new Response(JSON.stringify(summary, null, 2), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Failed to get revenue summary',
      message: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}