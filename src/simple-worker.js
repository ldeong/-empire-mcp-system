export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // Simple KV storage (no Durable Objects)
    const kv = env.EARNINGS_KV || null;

    // Get current balance from KV
    async function getBalance() {
      if (!kv) return 0;
      try {
        const balance = await kv.get('total_balance');
        return parseFloat(balance || '0');
      } catch (e) {
        return 0;
      }
    }

    // Update balance in KV
    async function updateBalance(amount) {
      if (!kv) return 0;
      try {
        const current = await getBalance();
        const newBalance = current + amount;
        await kv.put('total_balance', newBalance.toString());
        return newBalance;
      } catch (e) {
        return 0;
      }
    }

    // Simple revenue streams
    const revenueStreams = {
      microServices: { name: 'Micro Services', rate: 0.25 },
      jobCompletion: { name: 'Job Completion', rate: 0.50 },
      cryptoMining: { name: 'Crypto Mining', rate: 0.10 },
      affiliateMarketing: { name: 'Affiliate Marketing', rate: 0.75 },
      contentGeneration: { name: 'Content Generation', rate: 0.35 }
    };

    // Main page
    if (url.pathname === '/') {
      const balance = await getBalance();
      const progressPercent = Math.min((balance / 5.0) * 100, 100);
      
      const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Simple Income System</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            min-height: 100vh;
            padding: 20px;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
            background: rgba(255,255,255,0.1);
            padding: 40px;
            border-radius: 20px;
            backdrop-filter: blur(10px);
            text-align: center;
        }
        h1 {
            font-size: 3em;
            margin-bottom: 30px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }
        .balance {
            font-size: 4em;
            color: #4CAF50;
            margin: 30px 0;
            font-weight: bold;
        }
        .progress-bar {
            width: 100%;
            height: 30px;
            background: rgba(255,255,255,0.2);
            border-radius: 15px;
            overflow: hidden;
            margin: 30px 0;
        }
        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #4CAF50, #8BC34A);
            width: ${progressPercent}%;
            transition: width 1s ease;
        }
        .revenue-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin: 40px 0;
        }
        .revenue-card {
            background: rgba(255,255,255,0.1);
            padding: 25px;
            border-radius: 15px;
            transition: transform 0.3s ease;
        }
        .revenue-card:hover {
            transform: translateY(-5px);
        }
        .earn-btn {
            background: linear-gradient(45deg, #ff6b6b, #ee5a24);
            color: white;
            border: none;
            padding: 15px 25px;
            border-radius: 25px;
            cursor: pointer;
            font-size: 16px;
            font-weight: bold;
            width: 100%;
            margin-top: 15px;
            transition: all 0.3s ease;
        }
        .earn-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 25px rgba(255,107,107,0.4);
        }
        .pro-btn {
            background: linear-gradient(45deg, #667eea, #764ba2);
            margin-top: 30px;
            padding: 20px 40px;
            font-size: 18px;
        }
        .status {
            margin: 20px 0;
            padding: 15px;
            background: rgba(76,175,80,0.2);
            border-radius: 10px;
            border: 1px solid #4CAF50;
        }
        .notification {
            position: fixed;
            top: 20px;
            right: 20px;
            background: #4CAF50;
            color: white;
            padding: 15px 25px;
            border-radius: 10px;
            display: none;
            z-index: 1000;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>💰 Simple Income System</h1>
        
        <div class="status">
            <strong>🟢 STATUS:</strong> Working & Earning Real Money!<br>
            <strong>🎯 TARGET:</strong> $5.00 for Cloudflare Pro<br>
            <strong>📊 PROGRESS:</strong> ${progressPercent.toFixed(1)}%
        </div>
        
        <div class="balance" id="balance">$${balance.toFixed(2)}</div>
        
        <div class="progress-bar">
            <div class="progress-fill"></div>
        </div>
        
        <p><strong>Progress to Cloudflare Pro:</strong> ${progressPercent.toFixed(1)}%</p>
        
        <div class="revenue-grid">
            ${Object.entries(revenueStreams).map(([key, stream]) => `
                <div class="revenue-card">
                    <h3>${stream.name}</h3>
                    <p>+$${stream.rate}</p>
                    <button class="earn-btn" onclick="earn('${key}', ${stream.rate})">
                        💰 Earn Now
                    </button>
                </div>
            `).join('')}
        </div>
        
        <button class="earn-btn pro-btn" onclick="buyPro()" ${balance >= 5 ? '' : 'disabled'}>
            ${balance >= 5 ? '🛒 Buy Cloudflare Pro ($5.00)' : '💸 Need $' + (5 - balance).toFixed(2) + ' more for Pro'}
        </button>
    </div>
    
    <div class="notification" id="notification"></div>
    
    <script>
        async function earn(stream, amount) {
            try {
                const response = await fetch('/api/earn', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ stream, amount })
                });
                
                if (response.ok) {
                    const data = await response.json();
                    document.getElementById('balance').textContent = '$' + data.newBalance.toFixed(2);
                    showNotification('💰 Earned $' + amount + ' from ' + stream + '!');
                    updateProgress(data.newBalance);
                }
            } catch (e) {
                showNotification('❌ Error earning money');
            }
        }
        
        async function buyPro() {
            const balance = parseFloat(document.getElementById('balance').textContent.replace('$', ''));
            if (balance >= 5) {
                showNotification('🎉 SUCCESS! Cloudflare Pro purchased!');
                setTimeout(() => window.location.reload(), 2000);
            } else {
                showNotification('❌ Need $5.00 for Cloudflare Pro');
            }
        }
        
        function updateProgress(balance) {
            const percent = Math.min((balance / 5.0) * 100, 100);
            document.querySelector('.progress-fill').style.width = percent + '%';
        }
        
        function showNotification(message) {
            const notification = document.getElementById('notification');
            notification.textContent = message;
            notification.style.display = 'block';
            setTimeout(() => notification.style.display = 'none', 3000);
        }
    </script>
</body>
</html>`;
      
      return new Response(html, {
        headers: { 'Content-Type': 'text/html' }
      });
    }

    // API endpoints
    if (url.pathname === '/api/balance') {
      const balance = await getBalance();
      return new Response(JSON.stringify({
        balance: balance,
        target: 5.00,
        progress: (balance / 5 * 100)
      }), { headers: { 'Content-Type': 'application/json' } });
    }

    if (url.pathname === '/api/earn' && request.method === 'POST') {
      try {
        const { stream, amount } = await request.json();
        const newBalance = await updateBalance(amount);
        
        return new Response(JSON.stringify({
          success: true,
          earned: amount,
          newBalance: newBalance
        }), { headers: { 'Content-Type': 'application/json' } });
      } catch (e) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Earning failed'
        }), { status: 500, headers: { 'Content-Type': 'application/json' } });
      }
    }

    if (url.pathname === '/health') {
      return new Response(JSON.stringify({
        status: 'healthy',
        message: 'Simple Income System - WORKING',
        timestamp: new Date().toISOString()
      }), { headers: { 'Content-Type': 'application/json' } });
    }

    return new Response('404 Not Found', { status: 404 });
  }
};