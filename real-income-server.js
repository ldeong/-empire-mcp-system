const http = require('http');

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost:3333');
  
  if (url.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>REAL Income Opportunities - Earn Actual Money</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', sans-serif;
            background: linear-gradient(135deg, #2c3e50, #3498db, #e74c3c, #f39c12);
            background-size: 400% 400%;
            animation: gradientShift 10s ease infinite;
            color: white;
            min-height: 100vh;
            padding: 20px;
        }
        @keyframes gradientShift {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
        }
        .container { max-width: 1200px; margin: 0 auto; }
        .header {
            text-align: center;
            margin-bottom: 40px;
            background: rgba(0,0,0,0.3);
            padding: 40px;
            border-radius: 20px;
            backdrop-filter: blur(10px);
        }
        h1 {
            font-size: 3em;
            margin-bottom: 20px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.7);
        }
        .reality-check {
            background: rgba(231,76,60,0.3);
            border: 3px solid #e74c3c;
            padding: 30px;
            border-radius: 20px;
            margin-bottom: 30px;
            text-align: center;
        }
        .income-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
            gap: 25px;
            margin-bottom: 40px;
        }
        .income-card {
            background: rgba(255,255,255,0.15);
            padding: 30px;
            border-radius: 20px;
            backdrop-filter: blur(15px);
            border: 2px solid rgba(255,255,255,0.3);
            transition: all 0.3s ease;
        }
        .income-card:hover {
            transform: translateY(-10px);
            box-shadow: 0 20px 40px rgba(0,0,0,0.4);
            border-color: #3498db;
        }
        .income-card h3 {
            color: #3498db;
            margin-bottom: 15px;
            font-size: 1.4em;
        }
        .potential {
            color: #f39c12;
            font-weight: bold;
            font-size: 1.3em;
            margin: 15px 0;
        }
        .difficulty {
            display: inline-block;
            padding: 8px 20px;
            border-radius: 25px;
            font-size: 14px;
            font-weight: bold;
            margin-bottom: 15px;
        }
        .difficulty.Easy { background: #27ae60; }
        .difficulty.Medium { background: #f39c12; }
        .difficulty.Hard { background: #e74c3c; }
        .start-btn {
            background: linear-gradient(45deg, #27ae60, #2ecc71);
            color: white;
            border: none;
            padding: 15px 30px;
            border-radius: 30px;
            cursor: pointer;
            font-size: 16px;
            font-weight: bold;
            width: 100%;
            margin-top: 15px;
            transition: all 0.3s ease;
        }
        .start-btn:hover {
            background: linear-gradient(45deg, #2ecc71, #27ae60);
            transform: translateY(-2px);
            box-shadow: 0 10px 25px rgba(39,174,96,0.4);
        }
        .quick-start {
            background: rgba(39,174,96,0.2);
            border: 3px solid #27ae60;
            padding: 40px;
            border-radius: 20px;
            text-align: center;
            margin: 40px 0;
        }
        .quick-start h2 {
            color: #27ae60;
            margin-bottom: 20px;
            font-size: 2em;
        }
        .steps {
            background: rgba(52,152,219,0.2);
            border: 2px solid #3498db;
            padding: 30px;
            border-radius: 20px;
            margin: 30px 0;
            text-align: left;
        }
        .steps h3 {
            color: #3498db;
            margin-bottom: 20px;
            font-size: 1.6em;
            text-align: center;
        }
        .steps ol {
            font-size: 1.1em;
            line-height: 1.6;
        }
        .steps li {
            margin: 15px 0;
            padding: 10px;
            background: rgba(255,255,255,0.1);
            border-radius: 10px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>💰 REAL Income Opportunities</h1>
            <p style="font-size: 1.3em;">These are ACTUAL ways to earn REAL money online</p>
        </div>

        <div class="reality-check">
            <h2>🚨 BRUTAL HONESTY 🚨</h2>
            <p style="font-size: 1.2em; margin: 15px 0;"><strong>There is NO "magic money button"</strong></p>
            <p style="font-size: 1.1em;">Real income requires real work, real skills, and real time.</p>
            <p style="font-size: 1.1em;">But these opportunities below are LEGITIMATE and people earn from them daily.</p>
        </div>

        <div class="quick-start">
            <h2>🎯 FASTEST PATH TO $5 (Cloudflare Pro)</h2>
            <p style="font-size: 1.2em; margin: 20px 0;">
                <strong>Recommended Strategy:</strong> Cloudflare Affiliate + Quick Freelance Gig
            </p>
            <p style="font-size: 1.1em;">
                <strong>Timeline:</strong> 1-2 weeks with focused effort
            </p>
        </div>

        <div class="income-grid">
            <div class="income-card">
                <h3>🔗 Cloudflare Affiliate Program</h3>
                <div class="potential">$50-500/month</div>
                <div class="difficulty Easy">Easy</div>
                <p>Earn 20% commission on Cloudflare referrals. Sign up, create content, share your link.</p>
                <button class="start-btn" onclick="window.open('https://www.cloudflare.com/partners/', '_blank')">
                    🚀 Start Earning
                </button>
            </div>

            <div class="income-card">
                <h3>💼 Upwork Freelancing</h3>
                <div class="potential">$25-100/hour</div>
                <div class="difficulty Medium">Medium</div>
                <p>Freelance your coding/tech skills. Start with small projects to build reputation.</p>
                <button class="start-btn" onclick="window.open('https://www.upwork.com/', '_blank')">
                    🚀 Start Earning
                </button>
            </div>

            <div class="income-card">
                <h3>🎯 Fiverr Services</h3>
                <div class="potential">$5-500/gig</div>
                <div class="difficulty Easy">Easy</div>
                <p>Offer specific tech services: website fixes, code reviews, simple automations.</p>
                <button class="start-btn" onclick="window.open('https://www.fiverr.com/', '_blank')">
                    🚀 Start Earning
                </button>
            </div>

            <div class="income-card">
                <h3>💰 GitHub Sponsors</h3>
                <div class="potential">$100-1000/month</div>
                <div class="difficulty Medium">Medium</div>
                <p>Get sponsored for your open source contributions and projects.</p>
                <button class="start-btn" onclick="window.open('https://github.com/sponsors', '_blank')">
                    🚀 Start Earning
                </button>
            </div>

            <div class="income-card">
                <h3>🐛 Bug Bounty Programs</h3>
                <div class="potential">$100-10000/bug</div>
                <div class="difficulty Hard">Hard</div>
                <p>Find security vulnerabilities in websites and applications for rewards.</p>
                <button class="start-btn" onclick="window.open('https://hackerone.com/', '_blank')">
                    🚀 Start Earning
                </button>
            </div>

            <div class="income-card">
                <h3>📺 YouTube Tech Channel</h3>
                <div class="potential">$500-5000/month</div>
                <div class="difficulty Medium">Medium</div>
                <p>Create coding tutorials, tech reviews, and programming content.</p>
                <button class="start-btn" onclick="window.open('https://www.youtube.com/creators/', '_blank')">
                    🚀 Start Earning
                </button>
            </div>
        </div>

        <div class="steps">
            <h3>📋 STEP-BY-STEP: Earn Your First $5</h3>
            <ol>
                <li><strong>TODAY:</strong> Sign up for Cloudflare Partners program</li>
                <li><strong>TODAY:</strong> Create Upwork/Fiverr profile with your skills</li>
                <li><strong>DAY 2:</strong> Write a blog post about Cloudflare features</li>
                <li><strong>DAY 3:</strong> Apply for 5 small freelance gigs ($5-25 each)</li>
                <li><strong>WEEK 1:</strong> Share Cloudflare content with your referral link</li>
                <li><strong>WEEK 2:</strong> Complete first freelance project, get paid</li>
                <li><strong>WEEK 2-3:</strong> Receive first Cloudflare commission</li>
                <li><strong>GOAL ACHIEVED:</strong> Use earnings to buy Cloudflare Pro!</li>
            </ol>
        </div>

        <div class="quick-start">
            <h2>💡 START RIGHT NOW</h2>
            <p style="font-size: 1.1em; margin: 20px 0;">
                The fastest path is to combine multiple income streams.
                Even earning $1 from 5 different sources gets you to $5.
            </p>
            <p style="font-size: 1.2em; font-weight: bold;">
                🎯 Your mission: Earn $5 in the next 2 weeks
            </p>
        </div>
    </div>

    <script>
        console.log('REAL Income System loaded');
        console.log('Mission: Earn $5 for Cloudflare Pro');
        console.log('Method: Legitimate online income opportunities');
        
        // Track user engagement
        let clickCount = 0;
        document.querySelectorAll('.start-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                clickCount++;
                console.log('User taking action! Click', clickCount);
                btn.textContent = '✅ Opening...';
                setTimeout(() => {
                    btn.textContent = '🚀 Start Earning';
                }, 2000);
            });
        });
    </script>
</body>
</html>
`);
  } else if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'REAL',
      message: 'This system provides REAL income opportunities',
      opportunities: 6,
      disclaimer: 'Success requires actual effort and work',
      goal: 'Earn $5 for Cloudflare Pro'
    }));
  } else {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('REAL Income System - Visit http://localhost:3333/ for legitimate earning opportunities');
  }
});

server.listen(3333, () => {
  console.log('');
  console.log('🎉 ===== REAL INCOME SYSTEM LIVE ===== 🎉');
  console.log('');
  console.log('🔗 Open: http://localhost:3333/');
  console.log('');
  console.log('🎯 MISSION: Earn $5 for Cloudflare Pro');
  console.log('📊 METHOD: Legitimate online income opportunities');
  console.log('⏰ TIMELINE: 1-2 weeks with focused effort');
  console.log('');
  console.log('✅ NO fake "magic buttons"');
  console.log('✅ REAL opportunities that work');
  console.log('✅ People earn from these daily');
  console.log('');
  console.log('🚨 REQUIRES: Real effort and real work');
  console.log('💰 RESULT: Real money in your account');
  console.log('');
});