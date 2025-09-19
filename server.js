const express = require('express');
const path = require('path');
const { exec } = require('child_process');
const { SinaMCPManager } = require('./mcp-ecosystem-manager');
const { getScheduler, CRON_CONFIG } = require('./cron-scheduler');
const app = express();
const PORT = process.env.PORT || 3000;

// Initialize MCP Ecosystem Manager
const mcpManager = new SinaMCPManager();

app.use(express.json());
// Serve static PWA files from public/
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.send('SINA Empire CLI + PWA Server Running');
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Initialize cron scheduler & register baseline jobs
const scheduler = getScheduler();
try {
  scheduler.registerJob({
    id:'heartbeat',
    name:'System Heartbeat',
    scheduleSeconds: 60,
    expectedRuntimeSec: 1,
    handler: async () => ({ beat: new Date().toISOString() })
  });
  scheduler.registerJob({
    id:'jobs-drain',
    name:'Process Next Autonomous Job',
    scheduleSeconds: 90,
    expectedRuntimeSec: 5,
    handler: async () => {
      try {
        const { JobsManager, executeJobSimulation } = require('./autonomous-engine');
        const jm = new JobsManager();
        const job = await jm.next();
        if(!job) return { processed:false };
        await jm.markStarted(job.id);
        const result = await executeJobSimulation(job);
        if(result.success) await jm.markCompleted(job.id, result.result); else await jm.markFailed(job.id, result.error||'err');
        return { processed:true, jobId: job.id, type: job.type };
      } catch(e){ return { error: e.message }; }
    }
  });
} catch(e){ console.warn('Cron job registration issue:', e.message); }

// Cron endpoints
app.get('/cron/status', (req,res)=>{
  return res.json({ enabled: CRON_CONFIG.ENABLE, jobs: scheduler.listJobs(), stats: scheduler.getStats() });
});
app.post('/cron/run', async (req,res)=>{
  const { id } = req.body || {}; if(!id) return res.status(400).json({error:'id required'});
  try { const run = await scheduler.runJob(id,'manual'); res.json({ run }); } catch(e){ res.status(500).json({error:e.message}); }
});
app.get('/cron/runs', (req,res)=>{ const limit = parseInt(req.query.limit||'50'); res.json({ runs: scheduler.getRecentRuns(limit) }); });

// Auto-commit functionality
function runAutoCommit(options = {}) {
  return new Promise((resolve, reject) => {
    const command = `node ${path.join(__dirname, 'scripts', 'auto-commit.js')} ${options.dryRun ? '--dry-run' : ''} ${options.skipPush ? '--skip-push' : ''}`.trim();
    
    exec(command, { cwd: __dirname }, (error, stdout, stderr) => {
      if (error) {
        reject({ error: error.message, code: error.code, stderr });
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

// Coding agent trigger functionality  
function runCodingAgentTrigger(taskType, options = {}) {
  return new Promise((resolve, reject) => {
    let command = `node ${path.join(__dirname, 'scripts', 'coding-agent-trigger.js')} ${taskType}`;
    
    if (options.title) command += ` --title "${options.title}"`;
    if (options.desc) command += ` --desc "${options.desc}"`;
    if (options.files) command += ` --files "${options.files}"`;
    
    exec(command, { cwd: __dirname }, (error, stdout, stderr) => {
      if (error) {
        reject({ error: error.message, code: error.code, stderr });
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

app.post('/mcp/voice', async (req, res) => {
  const { command, sessionId } = req.body || {};
  console.log('Voice request', { command, sessionId });

  let response = {};
  let tts = `Processing ${command} for SINA Empire`;

  if (!command) {
    return res.status(400).json({ error: 'missing command' });
  }

  const cmd = command.toLowerCase();

  try {
    // MCP Ecosystem commands
    if (cmd.includes('mcp') || cmd.includes('cloudflare') || cmd.includes('github') || cmd.includes('asana')) {
      console.log('🔗 Processing MCP command...');

      const mcpResult = await mcpManager.processVoiceCommand(command, sessionId);

      if (mcpResult.success) {
        response = {
          mcp: {
            parsedCommand: mcpResult.parsedCommand,
            result: mcpResult.result,
            sessionId: mcpResult.sessionId,
            suggestions: mcpResult.suggestions
          },
          status: 'success'
        };
        tts = `MCP operation completed successfully. ${mcpResult.result?.result || 'Done'}`;
      } else {
        response = {
          mcp: {
            parsedCommand: mcpResult.parsedCommand,
            error: mcpResult.error,
            sessionId: mcpResult.sessionId,
            suggestions: mcpResult.suggestions
          },
          status: 'error'
        };
        tts = `MCP operation failed: ${mcpResult.error}`;
      }
    }
    // Workflow commands
    else if (cmd.includes('workflow') || cmd.includes('orchestrate')) {
      console.log('⚡ Processing workflow command...');

      // Extract workflow name
      const workflowMatch = cmd.match(/workflow\s+(?:called|run|execute)?\s*["']?([^"'\s]+)["']?/i);
      const workflowName = workflowMatch ? workflowMatch[1] : 'deploy-cloudflare-app';

      const workflowResult = await mcpManager.executeWorkflow(workflowName, sessionId || 'default');

      response = {
        workflow: {
          name: workflowName,
          execution: workflowResult,
          status: workflowResult.status
        },
        status: 'success'
      };
      tts = `Workflow ${workflowName} ${workflowResult.status}`;
    }
    // Status commands
    else if (cmd.includes('status') || cmd.includes('system')) {
      console.log('📊 Getting system status...');

      const systemStatus = mcpManager.getSystemStatus();

      response = {
        systemStatus,
        status: 'success'
      };
      tts = `System status retrieved. ${systemStatus.resilience.providers.length} MCP providers active.`;
    }
    // Auto-commit commands
    else if (cmd.includes('commit') && (cmd.includes('auto') || cmd.includes('changes'))) {
      console.log('🔄 Running auto-commit...');
      const result = await runAutoCommit();

      if (cmd.includes('dry') || cmd.includes('preview')) {
        // Dry run mode
        response = {
          autoCommit: {
            action: 'dry-run',
            result: result.stdout,
            status: 'preview'
          },
          status: 'success'
        };
        tts = 'Auto-commit preview completed. Check the results.';
      } else {
        // Full commit
        response = {
          autoCommit: {
            action: 'commit',
            result: result.stdout,
            status: 'committed'
          },
          status: 'success'
        };
        tts = 'Auto-commit completed successfully.';
      }
    }
    // Coding agent commands
    else if (cmd.includes('coding agent') || cmd.includes('code agent')) {
      console.log('🤖 Triggering coding agent...');

      let taskType = 'feature';
      if (cmd.includes('bug') || cmd.includes('fix')) taskType = 'bugfix';
      if (cmd.includes('refactor')) taskType = 'refactor';
      if (cmd.includes('test')) taskType = 'test';
      if (cmd.includes('docs') || cmd.includes('documentation')) taskType = 'documentation';

      const result = await runCodingAgentTrigger(taskType, {
        title: command,
        desc: `Voice-triggered coding agent task: ${command}`
      });

      response = {
        codingAgent: {
          taskType,
          result: result.stdout,
          status: 'triggered'
        },
        status: 'success'
      };
      tts = 'Coding agent session triggered. Check the GitHub issue for details.';
    }
    // Git status commands
    else if (cmd.includes('git status') || cmd.includes('repository')) {
      console.log('📊 Getting git status...');
      const result = await new Promise((resolve, reject) => {
        exec('git status --porcelain', { cwd: __dirname }, (error, stdout, stderr) => {
          if (error && error.code !== 0) {
            reject(error);
          } else {
            resolve({ stdout, stderr });
          }
        });
      });

      const changes = result.stdout.trim().split('\n').filter(line => line.trim()).length;

      response = {
        gitStatus: {
          changes: changes,
          details: result.stdout || 'No changes',
          status: changes > 0 ? 'has_changes' : 'clean'
        },
        status: 'success'
      };
      tts = changes > 0 ? `You have ${changes} uncommitted changes.` : 'Working directory is clean.';
    }
    // Existing commands
    else if (cmd.includes('revenue')) {
      response = {
        revenue: {
          api: 0,
          mcp: cmd.includes('darren') ? 600 : 0.25,
          fallback: 0
        },
        status: 'success'
      };
    } else if (cmd.includes('genealogy')) {
      response = { genealogy: { id: 'test_123', data: 'Family tree processed' }, status: 'success' };
    } else if (cmd.includes('empire') || cmd.includes('tell me about the empire')) {
      response = {
        empire: 'SINA Empire Infrastructure',
        workers: 12,
        d1_databases: 9,
        kv_namespaces: 19,
        r2_buckets: 5,
        status: 'success'
      };
    } else {
      response = { status: 'error', message: 'Unknown command' };
      tts = 'Sorry, I didn\'t understand that command.';
    }
  } catch (error) {
    console.error('Command execution error:', error);
    response = {
      status: 'error',
      message: error.message || 'Command execution failed',
      details: error.stderr || error.error
    };
    tts = 'Sorry, there was an error processing your command.';
  }

  res.json({
    status: 'ok',
    command,
    response,
    tts
  });
});

// Additional MCP endpoints
app.post('/mcp/auto-commit', async (req, res) => {
  try {
    const { dryRun, skipPush } = req.body || {};
    const result = await runAutoCommit({ dryRun, skipPush });

    res.json({
      status: 'success',
      result: result.stdout,
      action: dryRun ? 'dry-run' : 'commit'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
      details: error.stderr
    });
  }
});

app.post('/mcp/coding-agent', async (req, res) => {
  try {
    const { taskType, title, description, files } = req.body || {};
    const result = await runCodingAgentTrigger(taskType || 'feature', {
      title,
      desc: description,
      files: files?.join(',')
    });

    res.json({
      status: 'success',
      result: result.stdout,
      taskType: taskType || 'feature'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
      details: error.stderr
    });
  }
});

// New MCP Ecosystem endpoints
app.post('/mcp/execute', async (req, res) => {
  try {
    const { command, sessionId } = req.body || {};

    if (!command) {
      return res.status(400).json({ error: 'Command is required' });
    }

    const result = await mcpManager.processVoiceCommand(command, sessionId);

    res.json({
      status: result.success ? 'success' : 'error',
      result: result.success ? result.result : null,
      error: result.success ? null : result.error,
      parsedCommand: result.parsedCommand,
      sessionId: result.sessionId,
      suggestions: result.suggestions
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

app.post('/mcp/workflow', async (req, res) => {
  try {
    const { workflowName, sessionId, parameters } = req.body || {};

    if (!workflowName) {
      return res.status(400).json({ error: 'Workflow name is required' });
    }

    const result = await mcpManager.executeWorkflow(workflowName, sessionId || 'default', parameters || {});

    res.json({
      status: 'success',
      workflow: result
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

app.get('/mcp/status', (req, res) => {
  try {
    const status = mcpManager.getSystemStatus();

    res.json({
      status: 'success',
      system: status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

app.get('/mcp/workflows', (req, res) => {
  try {
    const workflows = mcpManager.orchestrationEngine.getWorkflowTemplates();

    res.json({
      status: 'success',
      workflows
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

app.get('/mcp/analytics', (req, res) => {
  try {
    const { timeframe } = req.query;
    const analytics = mcpManager.webhookManager.getAnalytics(timeframe || '1h');

    res.json({
      status: 'success',
      analytics
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

app.post('/mcp/webhook/register', (req, res) => {
  try {
    const { operationType, url, filters } = req.body || {};

    if (!operationType || !url) {
      return res.status(400).json({ error: 'operationType and url are required' });
    }

    const webhookId = mcpManager.webhookManager.registerWebhook(operationType, url, filters || {});

    res.json({
      status: 'success',
      webhookId,
      message: 'Webhook registered successfully'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// === Autonomous Engine Integration (appended) ===
let autonomousEngine, jobsMgr, execJobSim;
try {
  const { AutonomousReinvestmentEngine, JobsManager, executeJobSimulation } = require('./autonomous-engine');
  autonomousEngine = new AutonomousReinvestmentEngine();
  jobsMgr = new JobsManager();
  execJobSim = executeJobSimulation;
  console.log('⚙️ Autonomous engine loaded');
} catch (e) {
  console.warn('Autonomous engine not available:', e.message);
}

// Financial summary
app.get('/financial/summary', async (req,res)=>{
  if(!autonomousEngine) return res.status(503).json({error:'autonomous engine disabled'});
  try { return res.json(await autonomousEngine.getFinancialSummary()); } catch(e){ res.status(500).json({error:e.message}); }
});

// Add revenue
app.post('/financial/revenue', async (req,res)=>{
  if(!autonomousEngine) return res.status(503).json({error:'autonomous engine disabled'});
  try { const { amount, description, meta }=req.body||{}; const tx= await autonomousEngine.addTransaction('revenue', parseFloat(amount), description||'API Revenue', meta||{}); res.json({success:true, tx}); } catch(e){ res.status(400).json({error:e.message}); }
});

// Evaluate reinvestment
app.post('/invest/reinvest/evaluate', async (req,res)=>{
  if(!autonomousEngine) return res.status(503).json({error:'autonomous engine disabled'});
  try { const cycle = await autonomousEngine.evaluateReinvestmentCycle(); res.json({cycle, eligible: !!cycle}); } catch(e){ res.status(500).json({error:e.message}); }
});

// Execute reinvestment
app.post('/invest/reinvest/execute', async (req,res)=>{
  if(!autonomousEngine) return res.status(503).json({error:'autonomous engine disabled'});
  try { const { cycle_id } = req.body||{}; const cycle = await autonomousEngine.executeReinvestmentCycle(cycle_id); if(!cycle) return res.status(400).json({error:'no cycle available'}); res.json({success:true, cycle}); } catch(e){ res.status(500).json({error:e.message}); }
});

// Jobs listing
app.get('/jobs', async (req,res)=>{
  if(!jobsMgr) return res.status(503).json({error:'autonomous engine disabled'});
  try { const data = await jobsMgr.load(); res.json(data); } catch(e){ res.status(500).json({error:e.message}); }
});

// Run next job
app.post('/jobs/run-next', async (req,res)=>{
  if(!jobsMgr) return res.status(503).json({error:'autonomous engine disabled'});
  try { const job = await jobsMgr.next(); if(!job) return res.json({message:'no jobs'}); await jobsMgr.markStarted(job.id); const result = await execJobSim(job); if(result.success) await jobsMgr.markCompleted(job.id, result.result); else await jobsMgr.markFailed(job.id, result.error||'unknown'); res.json({jobId:job.id, result}); } catch(e){ res.status(500).json({error:e.message}); }
});

// System status (extended)
app.get('/autonomous/status', async (req,res)=>{
  if(!autonomousEngine) return res.status(503).json({error:'autonomous engine disabled'});
  try { res.json(await autonomousEngine.systemStatus()); } catch(e){ res.status(500).json({error:e.message}); }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Auto-commit integration active`);
  console.log(`Voice commands: "auto commit", "coding agent", "git status"`);
});
