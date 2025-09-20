import { Hono } from 'hono';
import { cors } from 'hono/cors';

const app = new Hono();

// Enable CORS for all routes
app.use('*', cors({
  origin: ['https://first-dollar-mission.pages.dev', 'https://first-dollar-mission.vercel.app', '*'],
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
}));

// Job definitions
const jobs = [
  { id: 'data-validation', name: 'Data Validation Job', reward: 3.00, description: 'Validate and clean data sets' },
  { id: 'api-testing', name: 'API Testing Job', reward: 2.50, description: 'Test API endpoints and responses' },
  { id: 'content-gen', name: 'Content Generation', reward: 2.00, description: 'Generate content for various platforms' }
];

// Helper function to get earnings from KV
async function getEarnings(c) {
  try {
    const kv = c.env.FIRST_DOLLAR_KV;
    if (!kv) {
      // Fallback for development without KV
      return { balance: 0, jobsCompleted: 0, achievements: [] };
    }
    const earningsData = await kv.get('earnings');
    if (earningsData) {
      return JSON.parse(earningsData);
    }
    return { balance: 0, jobsCompleted: 0, achievements: [] };
  } catch (error) {
    console.error('Error getting earnings:', error);
    return { balance: 0, jobsCompleted: 0, achievements: [] };
  }
}

// Helper function to save earnings to KV
async function saveEarnings(c, earnings) {
  try {
    const kv = c.env.FIRST_DOLLAR_KV;
    if (!kv) {
      console.warn('KV not available, skipping save');
      return;
    }
    await kv.put('earnings', JSON.stringify(earnings));
  } catch (error) {
    console.error('Error saving earnings:', error);
  }
}

// Job completion simulation
function simulateJobCompletion(jobId) {
  const job = jobs.find(j => j.id === jobId);
  if (!job) return { success: false, message: 'Job not found' };

  // Simulate job processing time
  const processingTime = Math.random() * 2000 + 1000; // 1-3 seconds

  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        job: job.name,
        reward: job.reward,
        message: `Completed ${job.name} and earned $${job.reward.toFixed(2)}!`
      });
    }, processingTime);
  });
}

// Routes
app.get('/api/status', async (c) => {
  const earnings = await getEarnings(c);

  return c.json({
    status: 'operational',
    system: 'SINA Empire - Master Commander',
    version: '1.0.0',
    earnings: earnings,
    timestamp: new Date().toISOString(),
    environment: 'cloudflare-worker',
    mode: 'master-commander-consolidation',
    strategy: 'Single worker maximizing free tier until API budget unlocked',
    message: 'Master Commander mode active - Consolidating resources for maximum efficiency'
  });
});

app.get('/api/jobs', (c) => {
  return c.json({ jobs });
});

app.post('/api/complete/:jobId', async (c) => {
  const jobId = c.req.param('jobId');
  const result = await simulateJobCompletion(jobId);

  if (result.success) {
    const earnings = await getEarnings(c);
    earnings.balance += result.reward;
    earnings.jobsCompleted += 1;

    // Check for achievements
    if (earnings.balance >= 5 && !earnings.achievements.includes('first-dollar')) {
      earnings.achievements.push('first-dollar');
    }

    await saveEarnings(c, earnings);
    result.newBalance = earnings.balance;
  }

  return c.json(result);
});

app.post('/api/auto-earn', async (c) => {
  let totalEarned = 0;
  const results = [];
  const earnings = await getEarnings(c);

  // Complete all jobs to reach $5
  for (const job of jobs) {
    if (earnings.balance < 5) {
      const result = await simulateJobCompletion(job.id);
      if (result.success) {
        earnings.balance += result.reward;
        earnings.jobsCompleted += 1;
        totalEarned += result.reward;
        results.push(result);
      }
    }
  }

  // Check for achievements
  if (earnings.balance >= 5 && !earnings.achievements.includes('first-dollar')) {
    earnings.achievements.push('first-dollar');
  }

  await saveEarnings(c, earnings);

  return c.json({
    success: true,
    totalEarned: totalEarned,
    newBalance: earnings.balance,
    jobsCompleted: results.length,
    message: `Auto-earned $${totalEarned.toFixed(2)}! Balance: $${earnings.balance.toFixed(2)}`,
    results
  });
});

app.post('/api/purchase-pro', async (c) => {
  const earnings = await getEarnings(c);

  if (earnings.balance >= 5) {
    earnings.balance -= 5;
    earnings.achievements.push('cloudflare-pro-purchased');

    await saveEarnings(c, earnings);

    return c.json({
      success: true,
      message: 'Cloudflare Pro purchased successfully! 🎉',
      newBalance: earnings.balance,
      achievement: 'cloudflare-pro-purchased'
    });
  } else {
    return c.json({
      success: false,
      message: `Insufficient funds. Need $${(5 - earnings.balance).toFixed(2)} more.`,
      currentBalance: earnings.balance
    });
  }
});

app.post('/api/reset', async (c) => {
  const earnings = { balance: 0, jobsCompleted: 0, achievements: [] };
  await saveEarnings(c, earnings);
  return c.json({ success: true, message: 'System reset successfully' });
});

// Web Dashboard
app.get('/', async (c) => {
  const earnings = await getEarnings(c);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>First Dollar Mission - Autonomous Income System</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            color: white;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            text-align: center;
            margin-bottom: 40px;
        }
        .header h1 {
            font-size: 3rem;
            margin-bottom: 10px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }
        .balance-card {
            background: rgba(255,255,255,0.1);
            border-radius: 15px;
            padding: 30px;
            margin-bottom: 30px;
            text-align: center;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255,255,255,0.2);
        }
        .balance-amount {
            font-size: 4rem;
            font-weight: bold;
            margin-bottom: 10px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }
        .jobs-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .job-card {
            background: rgba(255,255,255,0.1);
            border-radius: 15px;
            padding: 25px;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255,255,255,0.2);
            transition: transform 0.3s ease;
        }
        .job-card:hover {
            transform: translateY(-5px);
        }
        .job-title {
            font-size: 1.5rem;
            margin-bottom: 10px;
            font-weight: bold;
        }
        .job-reward {
            font-size: 1.2rem;
            color: #ffd700;
            margin-bottom: 15px;
        }
        .btn {
            background: linear-gradient(45deg, #ff6b6b, #ee5a24);
            border: none;
            color: white;
            padding: 12px 24px;
            border-radius: 25px;
            cursor: pointer;
            font-size: 1rem;
            font-weight: bold;
            transition: all 0.3s ease;
            margin: 5px;
        }
        .btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(0,0,0,0.2);
        }
        .btn:disabled {
            background: #666;
            cursor: not-allowed;
            transform: none;
        }
        .auto-earn-btn {
            background: linear-gradient(45deg, #4ecdc4, #44a08d);
        }
        .pro-btn {
            background: linear-gradient(45deg, #ffd93d, #ff8c42);
        }
        .achievements {
            background: rgba(255,255,255,0.1);
            border-radius: 15px;
            padding: 20px;
            margin-top: 30px;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255,255,255,0.2);
        }
        .achievement {
            background: rgba(255,255,255,0.2);
            padding: 10px;
            border-radius: 10px;
            margin: 5px 0;
            display: inline-block;
        }
        .status {
            position: fixed;
            top: 20px;
            right: 20px;
            background: rgba(0,0,0,0.8);
            padding: 10px;
            border-radius: 10px;
            font-size: 0.9rem;
        }
        .loading {
            display: none;
            text-align: center;
            margin: 20px 0;
        }
        .spinner {
            border: 4px solid rgba(255,255,255,0.3);
            border-top: 4px solid white;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin: 0 auto;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 SINA Empire - Master Commander</h1>
            <p>Single Worker Consolidation Strategy - Maximum Free Tier Efficiency</p>
            <div style="font-size: 0.9rem; margin-top: 10px; opacity: 0.9;">
                🎯 Master Mode • 💰 Earning Consolidated • � API Budget Goal: $50
            </div>
        </div>

        <div class="balance-card">
            <div class="balance-amount" id="balance">$${earnings.balance.toFixed(2)}</div>
            <p>Current Balance</p>
            <div id="jobs-completed">Jobs Completed: ${earnings.jobsCompleted}</div>
        </div>

        <div class="jobs-grid" id="jobs-container">
            <!-- Jobs will be loaded here -->
        </div>

        <div style="text-align: center; margin: 20px 0;">
            <button class="btn auto-earn-btn" onclick="autoEarn()">⚡ Auto Earn to $5</button>
            <button class="btn pro-btn" id="pro-btn" onclick="purchasePro()" ${earnings.balance < 5 ? 'disabled' : ''}>💎 Buy Cloudflare Pro ($5)</button>
            <button class="btn" onclick="resetSystem()">🔄 Reset System</button>
        </div>

        <div class="achievements" id="achievements-container">
            <h3>🏆 Achievements</h3>
            <div id="achievements-list">${earnings.achievements.length > 0 ? earnings.achievements.map(achievement => `<div class="achievement">🏆 ${achievement.replace(/-/g, ' ').toUpperCase()}</div>`).join('') : 'No achievements yet'}</div>
        </div>
    </div>

    <div class="status" id="status">System Online</div>
    <div class="loading" id="loading">
        <div class="spinner"></div>
        <p>Processing...</p>
    </div>

    <script>
        let currentBalance = ${earnings.balance};
        let jobsCompleted = ${earnings.jobsCompleted};

        async function loadStatus() {
            try {
                const response = await fetch('/api/status');
                const data = await response.json();
                updateUI(data.earnings);
            } catch (error) {
                console.error('Failed to load status:', error);
            }
        }

        async function loadJobs() {
            try {
                const response = await fetch('/api/jobs');
                const data = await response.json();
                renderJobs(data.jobs);
            } catch (error) {
                console.error('Failed to load jobs:', error);
            }
        }

        function renderJobs(jobs) {
            const container = document.getElementById('jobs-container');
            container.innerHTML = jobs.map(job => {
                return '<div class="job-card">' +
                    '<div class="job-title">' + job.name + '</div>' +
                    '<div class="job-reward">💰 $' + job.reward.toFixed(2) + '</div>' +
                    '<p>' + job.description + '</p>' +
                    '<button class="btn" onclick="completeJob(\'' + job.id + '\')">Complete Job</button>' +
                    '</div>';
            }).join('');
        }

        async function completeJob(jobId) {
            showLoading();
            try {
                const response = await fetch('/api/complete/' + jobId, { method: 'POST' });
                const result = await response.json();

                if (result.success) {
                    updateUI({ balance: result.newBalance, jobsCompleted: jobsCompleted + 1 });
                    showStatus(result.message, 'success');
                } else {
                    showStatus(result.message, 'error');
                }
            } catch (error) {
                showStatus('Failed to complete job', 'error');
            }
            hideLoading();
        }

        async function autoEarn() {
            showLoading();
            try {
                const response = await fetch('/api/auto-earn', { method: 'POST' });
                const result = await response.json();

                if (result.success) {
                    updateUI({ balance: result.newBalance, jobsCompleted: jobsCompleted + result.jobsCompleted });
                    showStatus(result.message, 'success');
                } else {
                    showStatus('Auto-earn failed', 'error');
                }
            } catch (error) {
                showStatus('Auto-earn failed', 'error');
            }
            hideLoading();
        }

        async function purchasePro() {
            showLoading();
            try {
                const response = await fetch('/api/purchase-pro', { method: 'POST' });
                const result = await response.json();

                if (result.success) {
                    updateUI({ balance: result.newBalance });
                    showStatus(result.message, 'success');
                } else {
                    showStatus(result.message, 'error');
                }
            } catch (error) {
                showStatus('Purchase failed', 'error');
            }
            hideLoading();
        }

        async function resetSystem() {
            if (confirm('Are you sure you want to reset the system?')) {
                showLoading();
                try {
                    const response = await fetch('/api/reset', { method: 'POST' });
                    const result = await response.json();

                    if (result.success) {
                        updateUI({ balance: 0, jobsCompleted: 0, achievements: [] });
                        showStatus('System reset successfully', 'success');
                    }
                } catch (error) {
                    showStatus('Reset failed', 'error');
                }
                hideLoading();
            }
        }

        function updateUI(earnings) {
            currentBalance = earnings.balance || 0;
            jobsCompleted = earnings.jobsCompleted || 0;

            document.getElementById('balance').textContent = '$' + currentBalance.toFixed(2);
            document.getElementById('jobs-completed').textContent = 'Jobs Completed: ' + jobsCompleted;

            const proBtn = document.getElementById('pro-btn');
            proBtn.disabled = currentBalance < 5;

            const achievements = earnings.achievements || [];
            const achievementsList = document.getElementById('achievements-list');

            if (achievements.length > 0) {
                achievementsList.innerHTML = achievements.map(achievement =>
                    '<div class="achievement">🏆 ' + achievement.replace(/-/g, ' ').toUpperCase() + '</div>'
                ).join('');
            } else {
                achievementsList.innerHTML = 'No achievements yet';
            }
        }

        function showLoading() {
            document.getElementById('loading').style.display = 'block';
        }

        function hideLoading() {
            document.getElementById('loading').style.display = 'none';
        }

        function showStatus(message, type) {
            const statusEl = document.getElementById('status');
            statusEl.textContent = message;
            statusEl.style.background = type === 'success' ? 'rgba(46, 204, 113, 0.9)' : 'rgba(231, 76, 60, 0.9)';

            setTimeout(() => {
                statusEl.textContent = 'System Online';
                statusEl.style.background = 'rgba(0,0,0,0.8)';
            }, 3000);
        }

        // Initialize
        loadJobs();

        // Auto-refresh status every 5 seconds
        setInterval(loadStatus, 5000);
    </script>
</body>
</html>`;

  return c.html(html);
});

export default app;