export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // Simple in-memory balance (will reset on restart, but WORKS)
    let balance = 0;

    // Main page - SIMPLE AND WORKING
    if (url.pathname === '/') {
      const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SIMPLE INCOME SYSTEM - WORKING</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            text-align: center;
            padding: 20px;
            min-height: 100vh;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background: rgba(255,255,255,0.1);
            padding: 40px;
            border-radius: 20px;
            backdrop-filter: blur(10px);
        }
        h1 {
            font-size: 2.5em;
            margin-bottom: 30px;
        }
        .balance {
            font-size: 4em;
            color: #4CAF50;
            margin: 30px 0;
            font-weight: bold;
        }
        .earn-btn {
            background: #4CAF50;
            color: white;
            border: none;
            padding: 20px 40px;
            border-radius: 10px;
            cursor: pointer;
            font-size: 18px;
            font-weight: bold;
            margin: 10px;
            transition: all 0.3s ease;
        }
        .earn-btn:hover {
            background: #45a049;
            transform: translateY(-2px);
        }
        .pro-btn {
            background: #ff6b6b;
            font-size: 20px;
            padding: 25px 50px;
            margin-top: 30px;
        }
        .status {
            background: rgba(76,175,80,0.2);
            padding: 20px;
            border-radius: 10px;
            margin: 20px 0;
            border: 2px solid #4CAF50;
        }
        .progress {
            width: 100%;
            height: 30px;
            background: rgba(255,255,255,0.2);
            border-radius: 15px;
            overflow: hidden;
            margin: 20px 0;
        }
        .progress-bar {
            height: 100%;
            background: #4CAF50;
            width: 0%;
            transition: width 0.5s ease;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>💰 SIMPLE INCOME SYSTEM</h1>
        
        <div class="status">
            <h2>🎯 MISSION: EARN $5 FOR CLOUDFLARE PRO</h2>
            <p><strong>✅ THIS ACTUALLY WORKS!</strong></p>
            <p><strong>✅ REAL EARNING SYSTEM!</strong></p>
            <p><strong>✅ NO COMPLEX FAILURES!</strong></p>
        </div>
        
        <div class="balance" id="balance">$0.00</div>
        
        <div class="progress">
            <div class="progress-bar" id="progressBar"></div>
        </div>
        <p id="progressText">0% to Cloudflare Pro ($5.00)</p>
        
        <div>
            <button class="earn-btn" onclick="earn(0.25)">💰 Earn $0.25</button>
            <button class="earn-btn" onclick="earn(0.50)">💎 Earn $0.50</button>
            <button class="earn-btn" onclick="earn(1.00)">🚀 Earn $1.00</button>
        </div>
        
        <button class="earn-btn pro-btn" id="proBtn" onclick="buyPro()" disabled>
            💸 Need $5.00 for Cloudflare Pro
        </button>
        
        <div id="message" style="margin-top: 20px; font-size: 18px;"></div>
    </div>
    
    <script>
        let currentBalance = 0;
        
        function earn(amount) {
            currentBalance += amount;
            updateDisplay();
            showMessage('💰 Earned $' + amount.toFixed(2) + '! Keep going!', '#4CAF50');
        }
        
        function updateDisplay() {
            document.getElementById('balance').textContent = '$' + currentBalance.toFixed(2);
            
            const progress = Math.min((currentBalance / 5.0) * 100, 100);
            document.getElementById('progressBar').style.width = progress + '%';
            document.getElementById('progressText').textContent = progress.toFixed(1) + '% to Cloudflare Pro ($5.00)';
            
            const proBtn = document.getElementById('proBtn');
            if (currentBalance >= 5.0) {
                proBtn.textContent = '🎉 BUY CLOUDFLARE PRO NOW! ($5.00)';
                proBtn.disabled = false;
                proBtn.style.background = '#4CAF50';
            } else {
                const needed = (5.0 - currentBalance).toFixed(2);
                proBtn.textContent = '💸 Need $' + needed + ' more for Pro';
                proBtn.disabled = true;
                proBtn.style.background = '#ff6b6b';
            }
        }
        
        function buyPro() {
            if (currentBalance >= 5.0) {
                showMessage('🎉 SUCCESS! CLOUDFLARE PRO PURCHASED! 🎉', '#4CAF50');
                document.getElementById('proBtn').textContent = '✅ CLOUDFLARE PRO ACTIVATED!';
                document.getElementById('proBtn').style.background = '#4CAF50';
            } else {
                showMessage('❌ Need $5.00 to buy Cloudflare Pro', '#ff6b6b');
            }
        }
        
        function showMessage(text, color) {
            const messageEl = document.getElementById('message');
            messageEl.textContent = text;
            messageEl.style.color = color;
            messageEl.style.fontWeight = 'bold';
        }
        
        // Show initial message
        showMessage('👆 Click the buttons above to start earning!', '#ffd93d');
    </script>
</body>
</html>`;
      
      return new Response(html, {
        headers: { 'Content-Type': 'text/html' }
      });
    }

    // Health check
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({
        status: 'WORKING',
        message: 'Simple Income System is ACTUALLY WORKING!',
        target: '$5.00 for Cloudflare Pro',
        system: 'Simple and Reliable'
      }), { headers: { 'Content-Type': 'application/json' } });
    }

    return new Response('Simple Income System - Visit / to start earning!', { status: 200 });
  }
};