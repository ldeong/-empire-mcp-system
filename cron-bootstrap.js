// Cron Jobs Bootstrap: Register essential scheduled tasks
// Sets up balance verification, pipeline KPI refresh, and reinvestment monitoring

const { getScheduler } = require('./cron-scheduler');
const { AutonomousReinvestmentEngine } = require('./autonomous-engine');
const { WalletManagerBridge } = require('./wallet-manager-bridge');
const { getPipelineConfig } = require('./config-resolver');

// Initialize components
const scheduler = getScheduler();
const autonomousEngine = new AutonomousReinvestmentEngine();
const walletBridge = new WalletManagerBridge();
walletBridge.setAutonomousEngine(autonomousEngine);

const PIPELINE_CONFIG = getPipelineConfig();

// Daily Balance Verification Job (6 AM UTC)
scheduler.registerJob({
  id: 'daily_balance_verification',
  name: 'Daily Wallet Balance Verification',
  scheduleSeconds: 24 * 60 * 60, // 24 hours
  expectedRuntimeSec: 60,
  handler: async ({ runId, trigger }) => {
    console.log(`[${runId}] Starting daily balance verification (${trigger})`);
    
    try {
      // Verify all wallet balances against blockchain
      const verification = await walletBridge.verifyAllWalletBalances();
      
      // Get financial summary from autonomous engine
      const summary = await autonomousEngine.getFinancialSummary();
      
      // Check for discrepancies
      const discrepancies = verification.discrepancies || [];
      if (discrepancies.length > 0) {
        console.warn(`[${runId}] Found ${discrepancies.length} balance discrepancies:`, discrepancies);
      }
      
      return {
        verified_wallets: verification.verified_wallets,
        total_blockchain_balance: verification.total_balance,
        internal_ledger_balance: summary.balance,
        discrepancies: discrepancies.length,
        status: discrepancies.length > 0 ? 'discrepancies_found' : 'verified',
        verification_time: verification.verification_time
      };
    } catch (error) {
      console.error(`[${runId}] Balance verification failed:`, error.message);
      throw error;
    }
  },
  kpiSchema: {
    verified_wallets: 'number',
    total_blockchain_balance: 'number',
    internal_ledger_balance: 'number',
    discrepancies: 'number',
    status: 'string'
  }
});

// Reinvestment Monitoring Job (every 4 hours)
scheduler.registerJob({
  id: 'reinvestment_monitor',
  name: 'Autonomous Reinvestment Monitor',
  scheduleSeconds: 4 * 60 * 60, // 4 hours
  expectedRuntimeSec: 30,
  handler: async ({ runId, trigger }) => {
    console.log(`[${runId}] Checking reinvestment opportunities (${trigger})`);
    
    try {
      // Get current financial status
      const status = await autonomousEngine.systemStatus();
      
      // Evaluate potential reinvestment
      const cycle = await autonomousEngine.evaluateReinvestmentCycle();
      
      let result = {
        current_balance: status.summary.balance,
        reinvest_threshold: autonomousEngine.CONFIG?.REINVEST_THRESHOLD || 100,
        eligible_for_reinvest: !!cycle,
        queued_jobs: status.queued_jobs,
        executing_cycles: status.executing_cycles
      };
      
      if (cycle) {
        console.log(`[${runId}] Reinvestment cycle eligible: ${cycle.reinvest_amount} credits`);
        result.cycle_id = cycle.id;
        result.reinvest_amount = cycle.reinvest_amount;
        result.estimated_agents = cycle.allocations.agents.estimated_agents;
        
        // Auto-execute if enabled
        if (autonomousEngine.CONFIG?.INVESTMENT_AUTO_EXECUTE) {
          const executed = await autonomousEngine.executeReinvestmentCycle(cycle.id);
          result.auto_executed = true;
          result.queued_actions = executed.executed_actions;
          console.log(`[${runId}] Auto-executed reinvestment: ${executed.executed_actions} jobs queued`);
        }
      }
      
      return result;
    } catch (error) {
      console.error(`[${runId}] Reinvestment monitoring failed:`, error.message);
      throw error;
    }
  },
  kpiSchema: {
    current_balance: 'number',
    eligible_for_reinvest: 'boolean',
    reinvest_amount: 'number',
    queued_jobs: 'number',
    auto_executed: 'boolean'
  }
});

// Pipeline KPI Refresh Job (every 4 hours)
scheduler.registerJob({
  id: 'pipeline_kpi_refresh',
  name: 'Lead Pipeline KPI Refresh',
  scheduleSeconds: PIPELINE_CONFIG.KPI_INTERVAL_MIN * 60, // Convert minutes to seconds
  expectedRuntimeSec: 45,
  handler: async ({ runId, trigger }) => {
    console.log(`[${runId}] Refreshing pipeline KPIs (${trigger})`);
    
    try {
      // TODO: Integrate with lead-pipeline.js when available
      // For now, simulate KPI generation
      
      const mockKPIs = {
        total_leads: Math.floor(Math.random() * 100) + 50,
        qualified_leads: Math.floor(Math.random() * 40) + 20,
        conversion_rate: +(Math.random() * 0.15 + 0.05).toFixed(3),
        pipeline_velocity_days: +(Math.random() * 10 + 5).toFixed(1),
        top_performing_stage: ['qualification', 'proposal', 'negotiation'][Math.floor(Math.random() * 3)],
        revenue_potential: +(Math.random() * 50000 + 10000).toFixed(2)
      };
      
      // TODO: Save to leads ledger file
      console.log(`[${runId}] Generated pipeline KPIs:`, mockKPIs);
      
      return {
        ...mockKPIs,
        refresh_time: new Date().toISOString(),
        status: 'refreshed'
      };
    } catch (error) {
      console.error(`[${runId}] Pipeline KPI refresh failed:`, error.message);
      throw error;
    }
  },
  kpiSchema: {
    total_leads: 'number',
    qualified_leads: 'number',
    conversion_rate: 'number',
    pipeline_velocity_days: 'number',
    revenue_potential: 'number'
  }
});

// Job Queue Health Monitor (every 30 minutes)
scheduler.registerJob({
  id: 'job_queue_monitor',
  name: 'Job Queue Health Monitor',
  scheduleSeconds: 30 * 60, // 30 minutes
  expectedRuntimeSec: 15,
  handler: async ({ runId, trigger }) => {
    console.log(`[${runId}] Monitoring job queue health (${trigger})`);
    
    try {
      const { JobsManager } = require('./autonomous-engine');
      const jobsManager = new JobsManager();
      
      const allJobs = await jobsManager.load();
      const jobs = allJobs.jobs;
      
      const stats = {
        total_jobs: jobs.length,
        queued: jobs.filter(j => j.status === 'queued').length,
        running: jobs.filter(j => j.status === 'running').length,
        completed: jobs.filter(j => j.status === 'completed').length,
        failed: jobs.filter(j => j.status === 'failed').length,
        stuck_jobs: jobs.filter(j => j.status === 'running' && 
          Date.now() - new Date(j.started_at).getTime() > 10 * 60 * 1000).length // Stuck for >10min
      };
      
      // Flag health issues
      const issues = [];
      if (stats.stuck_jobs > 0) {
        issues.push(`${stats.stuck_jobs} jobs stuck in running state`);
      }
      if (stats.failed > stats.completed * 0.1) {
        issues.push(`High failure rate: ${stats.failed} failed vs ${stats.completed} completed`);
      }
      if (stats.queued > 50) {
        issues.push(`Large queue backlog: ${stats.queued} jobs queued`);
      }
      
      const result = {
        ...stats,
        health_score: issues.length === 0 ? 1.0 : Math.max(0.1, 1.0 - issues.length * 0.3),
        issues: issues.length,
        status: issues.length === 0 ? 'healthy' : 'issues_detected'
      };
      
      if (issues.length > 0) {
        console.warn(`[${runId}] Job queue issues detected:`, issues);
      }
      
      return result;
    } catch (error) {
      console.error(`[${runId}] Job queue monitoring failed:`, error.message);
      throw error;
    }
  },
  kpiSchema: {
    total_jobs: 'number',
    queued: 'number',
    running: 'number',
    completed: 'number',
    failed: 'number',
    health_score: 'number',
    issues: 'number'
  }
});

// System Status Summary (every 2 hours)
scheduler.registerJob({
  id: 'system_status_summary',
  name: 'System Status Summary',
  scheduleSeconds: 2 * 60 * 60, // 2 hours
  expectedRuntimeSec: 20,
  handler: async ({ runId, trigger }) => {
    console.log(`[${runId}] Generating system status summary (${trigger})`);
    
    try {
      const systemStatus = await autonomousEngine.systemStatus();
      const walletConfig = walletBridge.getConfigSummary();
      
      const summary = {
        financial: {
          revenue: systemStatus.summary.revenue,
          expenses: systemStatus.summary.expenses,
          balance: systemStatus.summary.balance,
          net_profit: systemStatus.summary.net_profit
        },
        operations: {
          reinvest_cycles: systemStatus.reinvest_cycles,
          queued_jobs: systemStatus.queued_jobs,
          executing_cycles: systemStatus.executing_cycles
        },
        configuration: {
          real_income_mode: walletConfig.real_income_mode,
          btc_network: walletConfig.btc_network,
          min_confirmations: walletConfig.min_confirmations
        },
        timestamp: new Date().toISOString()
      };
      
      console.log(`[${runId}] System summary:`, {
        balance: summary.financial.balance,
        jobs: summary.operations.queued_jobs,
        cycles: summary.operations.reinvest_cycles
      });
      
      return summary;
    } catch (error) {
      console.error(`[${runId}] System status summary failed:`, error.message);
      throw error;
    }
  },
  kpiSchema: {
    'financial.balance': 'number',
    'financial.revenue': 'number',
    'operations.queued_jobs': 'number',
    'operations.reinvest_cycles': 'number'
  }
});

// Export scheduler and job registration functions
function startAllJobs() {
  console.log('🚀 Starting cron scheduler with registered jobs...');
  const jobs = scheduler.listJobs();
  console.log(`Registered ${jobs.length} cron jobs:`, jobs.map(j => j.name));
  return scheduler;
}

function runJobNow(jobId) {
  return scheduler.runJob(jobId, 'manual');
}

function getJobStats() {
  return {
    scheduler_stats: scheduler.getStats(),
    recent_runs: scheduler.getRecentRuns(10),
    registered_jobs: scheduler.listJobs()
  };
}

module.exports = {
  scheduler,
  startAllJobs,
  runJobNow,
  getJobStats,
  autonomousEngine,
  walletBridge
};