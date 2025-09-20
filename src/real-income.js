export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // REAL income opportunities - these are actual ways to earn money
    const realIncomeStreams = [
      {
        name: "Cloudflare Affiliate Program",
        description: "Earn 20% commission on Cloudflare referrals",
        action: "https://www.cloudflare.com/partners/",
        potential: "$50-500/month",
        difficulty: "Easy"
      },
      {
        name: "GitHub Sponsors",
        description: "Get sponsored for your open source work",
        action: "https://github.com/sponsors",
        potential: "$100-1000/month",
        difficulty: "Medium"
      },
      {
        name: "Upwork Freelancing",
        description: "Freelance your coding skills",
        action: "https://www.upwork.com/",
        potential: "$25-100/hour",
        difficulty: "Medium"
      },
      {
        name: "Create Digital Products",
        description: "Sell templates, courses, or tools",
        action: "https://gumroad.com/",
        potential: "$500-5000/month",
        difficulty: "Hard"
      },
      {
        name: "Bug Bounty Programs",
        description: "Find security vulnerabilities for rewards",
        action: "https://hackerone.com/",
        potential: "$100-10000/bug",
        difficulty: "Hard"
      },
      {
        name: "YouTube Tech Channel",
        description: "Create coding tutorials and monetize",
        action: "https://www.youtube.com/creators/",
        potential: "$500-5000/month",
        difficulty: "Medium"
      },
      {
        name: "Stripe Atlas Business",
        description: "Start a real tech business",
        action: "https://stripe.com/atlas",
        potential: "$1000+/month",
        difficulty: "Hard"
      },
      {
        name: "AWS Certification Training",
        description: "Get certified, charge premium rates",
        action: "https://aws.amazon.com/certification/",
        potential: "$75-150/hour",
        difficulty: "Medium"
      }
    ];

    if (url.pathname === '/') {
      const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>REAL Income Opportunities - Make Actual Money</title>
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
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
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
        .disclaimer {
            background: rgba(231,76,60,0.2);
            border: 2px solid #e74c3c;
            padding: 20px;
            border-radius: 15px;
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
            background: rgba(255,255,255,0.1);
            padding: 30px;
            border-radius: 20px;
            backdrop-filter: blur(15px);
            border: 1px solid rgba(255,255,255,0.2);
            transition: all 0.3s ease;
            position: relative;
            overflow: hidden;
        }
        .income-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
            transition: left 0.5s;
        }
        .income-card:hover::before {
            left: 100%;
        }
        .income-card:hover {
            transform: translateY(-10px);
            box-shadow: 0 20px 40px rgba(0,0,0,0.3);
            border-color: rgba(52,152,219,0.5);
        }
        .income-card h3 {
            color: #3498db;
            margin-bottom: 15px;
            font-size: 1.4em;
        }
        .potential {
            color: #f39c12;
            font-weight: bold;
            font-size: 1.2em;
            margin: 15px 0;
        }
        .difficulty {
            display: inline-block;
            padding: 5px 15px;
            border-radius: 20px;
            font-size: 14px;
            font-weight: bold;
            margin-bottom: 15px;
        }
        .difficulty.Easy { background: #27ae60; }
        .difficulty.Medium { background: #f39c12; }
        .difficulty.Hard { background: #e74c3c; }
        .action-btn {
            background: linear-gradient(45deg, #3498db, #2980b9);
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
            text-decoration: none;
            display: inline-block;
            text-align: center;
        }
        .action-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 25px rgba(52,152,219,0.4);
            background: linear-gradient(45deg, #2980b9, #3498db);
        }
        .cloudflare-target {
            background: rgba(52,152,219,0.2);
            border: 2px solid #3498db;
            padding: 30px;
            border-radius: 20px;
            text-align: center;
            margin: 40px 0;
        }
        .real-steps {
            background: rgba(39,174,96,0.2);
            border: 2px solid #27ae60;
            padding: 30px;
            border-radius: 20px;
            margin: 30px 0;
        }
        .real-steps h3 {
            color: #27ae60;
            margin-bottom: 20px;
            font-size: 1.5em;
        }
        .real-steps ol {
            text-align: left;
            margin-left: 20px;
        }
        .real-steps li {
            margin: 10px 0;
            font-size: 1.1em;
        }
        .warning {
            background: rgba(243,156,18,0.2);
            border: 2px solid #f39c12;
            padding: 20px;
            border-radius: 15px;
            margin: 20px 0;
            text-align: center;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>💰 REAL Income Opportunities</h1>
            <p>These are ACTUAL ways to earn REAL money online</p>
        </div>

        <div class="disclaimer">
            <h2>⚠️ REALITY CHECK ⚠️</h2>
            <p><strong>There is NO "magic button" that instantly generates money.</strong></p>
            <p>Real income requires real work, real skills, and real time investment.</p>
            <p>Below are legitimate opportunities that can generate actual income.</p>
        </div>

        <div class="cloudflare-target">
            <h2>🎯 YOUR GOAL: $5 for Cloudflare Pro</h2>
            <p>Based on the opportunities below, here's the fastest path:</p>
            <p><strong>Recommended: Cloudflare Affiliate Program + Freelancing</strong></p>
            <p>Timeline: 1-4 weeks with consistent effort</p>
        </div>

        <div class="income-grid">
            ${realIncomeStreams.map(stream => `
                <div class="income-card">
                    <h3>${stream.name}</h3>
                    <div class="potential">${stream.potential}</div>
                    <div class="difficulty ${stream.difficulty}">${stream.difficulty}</div>
                    <p>${stream.description}</p>
                    <a href="${stream.action}" target="_blank" class="action-btn">
                        🚀 Start Earning
                    </a>
                </div>
            `).join('')}
        </div>

        <div class="real-steps">
            <h3>📋 REAL Steps to Earn Your First $5</h3>
            <ol>
                <li><strong>Sign up for Cloudflare Partners</strong> - Earn 20% commission on referrals</li>
                <li><strong>Create content about Cloudflare</strong> - Blog posts, tutorials, videos</li>
                <li><strong>Share your referral link</strong> - Social media, forums, communities</li>
                <li><strong>Join Upwork/Fiverr</strong> - Offer your coding/tech skills</li>
                <li><strong>Complete small projects</strong> - Build reputation and earn money</li>
                <li><strong>Compound your earnings</strong> - Reinvest in better tools and skills</li>
            </ol>
        </div>

        <div class="warning">
            <h3>🔥 HONEST TRUTH</h3>
            <p><strong>Making money online requires:</strong></p>
            <p>• Real skills • Real effort • Real time • Real patience</p>
            <p><strong>But it IS possible and people do it every day!</strong></p>
        </div>

        <div class="cloudflare-target">
            <h2>💡 Quick Start Recommendation</h2>
            <p><strong>Today:</strong> Sign up for Cloudflare Partners & create Upwork profile</p>
            <p><strong>This Week:</strong> Complete first freelance gig & share Cloudflare content</p>
            <p><strong>Within 30 days:</strong> Earn your $5 for Cloudflare Pro</p>
            <a href="https://www.cloudflare.com/partners/" target="_blank" class="action-btn" style="max-width: 300px; margin: 20px auto;">
                🎯 Start with Cloudflare Partners
            </a>
        </div>
    </div>

    <script>
        // Track clicks to show engagement
        document.querySelectorAll('.action-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                // Show user is taking action
                setTimeout(() => {
                    console.log('User clicked:', e.target.textContent);
                }, 100);
            });
        });

        // Add some interactive feedback
        document.querySelectorAll('.income-card').forEach(card => {
            card.addEventListener('click', () => {
                card.style.borderColor = 'rgba(52,152,219,0.8)';
                setTimeout(() => {
                    card.style.borderColor = 'rgba(255,255,255,0.2)';
                }, 2000);
            });
        });
    </script>
</body>
</html>`;

      return new Response(html, {
        headers: { 'Content-Type': 'text/html' }
      });
    }

    // API endpoint with real earning data
    if (url.pathname === '/api/opportunities') {
      return new Response(JSON.stringify({
        opportunities: realIncomeStreams,
        fastest_path: {
          method: "Cloudflare Affiliate + Freelancing",
          timeline: "1-4 weeks",
          effort_required: "Medium",
          success_rate: "High with consistent effort"
        },
        reality_check: {
          message: "No magic buttons exist. Real income requires real work.",
          minimum_time_investment: "10-20 hours/week",
          success_depends_on: ["Skills", "Effort", "Consistency", "Market demand"]
        }
      }), { 
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (url.pathname === '/health') {
      return new Response(JSON.stringify({
        status: 'REAL',
        message: 'This system provides REAL income opportunities',
        disclaimer: 'Success requires actual effort and work',
        opportunities_count: realIncomeStreams.length
      }), { headers: { 'Content-Type': 'application/json' } });
    }

    return new Response(`
REAL Income System

This system provides REAL opportunities to earn ACTUAL money.

Visit the main page to see legitimate income streams that can help you earn your $5 for Cloudflare Pro.

No magic buttons, no fake earnings - just real opportunities that require real work.
    `, { status: 200 });
  }
};