// Autonomous Reinvestment & Jobs Engine (CommonJS)
// Provides financial ledger, reinvestment evaluation, execution pipeline, and job queue
// Non-destructive addition; coexists with existing crypto-ledger based wallet system.

const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { getAutonomousConfig } = require('./config-resolver');

const CONFIG = getAutonomousConfig();

function ensureDir(p){ if(!fs.existsSync(p)) fs.mkdirSync(p,{recursive:true}); }

async function safeLoadJSON(file, def){
  try { const raw = await fsp.readFile(file,'utf8'); return JSON.parse(raw); } catch(e){
    if(e.code === 'ENOENT'){ await safeWriteJSON(file, def); return def; }
    throw e;
  }
}
async function safeWriteJSON(file, data){ await fsp.writeFile(file, JSON.stringify(data,null,2),'utf8'); }

class JobsManager {
  constructor(){ this.file = CONFIG.JOBS_FILE; ensureDir(path.dirname(this.file)); }
  async load(){ return safeLoadJSON(this.file, { jobs: [] }); }
  async save(data){ return safeWriteJSON(this.file, data); }
  async enqueue({ type, priority='medium', payload={}, cost=0, cycle_id=null, action_id=null }){
    const data = await this.load();
    const job = { id: uuidv4(), type, priority, payload, cost, cycle_id, action_id, status:'queued', created_at:new Date().toISOString(), started_at:null, completed_at:null, attempts:0, max_attempts:CONFIG.MAX_JOB_ATTEMPTS, error:null };
    data.jobs.push(job); await this.save(data); return job;
  }
  async next(){
    const data = await this.load();
    const priorities = { high:3, medium:2, low:1 };
    return data.jobs.filter(j=>j.status==='queued' && j.attempts < j.max_attempts)
      .sort((a,b)=> priorities[b.priority]-priorities[a.priority] || new Date(a.created_at)-new Date(b.created_at))[0] || null;
  }
  async markStarted(id){ const data = await this.load(); const j = data.jobs.find(j=>j.id===id); if(j){ j.status='running'; j.started_at=new Date().toISOString(); j.attempts++; await this.save(data);} return j; }
  async markCompleted(id, result){ const data=await this.load(); const j=data.jobs.find(j=>j.id===id); if(j){ j.status='completed'; j.completed_at=new Date().toISOString(); j.result=result; await this.save(data);} return j; }
  async markFailed(id, error){ const data=await this.load(); const j=data.jobs.find(j=>j.id===id); if(j){ j.status = j.attempts >= j.max_attempts ? 'failed':'queued'; j.error=error; await this.save(data);} return j; }
}

class AutonomousReinvestmentEngine {
  constructor(){ ensureDir(CONFIG.DATA_DIR); }
  async getFinancialSummary(){
    const ledger = await safeLoadJSON(CONFIG.LEDGER_FILE, { total_revenue:0, total_expenses:0, available_balance:0, transactions:[], last_updated:null });
    return { revenue: ledger.total_revenue, expenses: ledger.total_expenses, balance: ledger.available_balance, net_profit: ledger.total_revenue - ledger.total_expenses, transaction_count: ledger.transactions.length };
  }
  async addTransaction(type, amount, description, metadata={}){
    if(amount <= 0) throw new Error('Amount must be > 0');
    const ledger = await safeLoadJSON(CONFIG.LEDGER_FILE, { total_revenue:0, total_expenses:0, available_balance:0, transactions:[] });
    const tx = { id: uuidv4(), type, amount, description, metadata, timestamp:new Date().toISOString(), balance_after:0 };
    if(type==='revenue'){ ledger.total_revenue += amount; ledger.available_balance += amount; }
    else if(type==='expense' || type==='reinvestment'){ ledger.total_expenses += amount; ledger.available_balance -= amount; }
    tx.balance_after = ledger.available_balance; ledger.transactions.push(tx); ledger.last_updated = new Date().toISOString();
    await safeWriteJSON(CONFIG.LEDGER_FILE, ledger); return tx;
  }
  async evaluateReinvestmentCycle(){
    const summary = await this.getFinancialSummary();
    const cycles = await safeLoadJSON(CONFIG.REINVEST_FILE, { cycles: [] });
    if(summary.balance < CONFIG.REINVEST_THRESHOLD) return null;
    const reinvestAmount = +(summary.balance * 0.8).toFixed(2); // 80% reinvest policy
    const agentAlloc = +(reinvestAmount * CONFIG.AGENT_SPAWN_ALLOCATION).toFixed(2);
    const infraAlloc = +(reinvestAmount * CONFIG.INFRASTRUCTURE_ALLOCATION).toFixed(2);
    const reservesAlloc = +(reinvestAmount * CONFIG.RESERVES_ALLOCATION).toFixed(2);
    const estAgents = Math.min(CONFIG.MAX_AUTO_AGENTS, Math.floor(agentAlloc / CONFIG.REINVEST_AGENT_COST));
    const cycle = { id: uuidv4(), created_at:new Date().toISOString(), status:'planned', available_balance: summary.balance, reinvest_amount: reinvestAmount, allocations:{ agents:{ amount:agentAlloc, estimated_agents: estAgents, status:'planned' }, infrastructure:{ amount: infraAlloc, status:'planned'}, reserves:{ amount: reservesAlloc, status:'planned'} }, actions: [] };
    cycle.actions = this._generateActions(cycle);
    cycles.cycles.push(cycle); await safeWriteJSON(CONFIG.REINVEST_FILE, cycles); return cycle;
  }
  _generateActions(cycle){
    const actions=[]; for(let i=0;i<cycle.allocations.agents.estimated_agents;i++){ actions.push({ id:uuidv4(), type:'spawn_agent', priority:'high', cost:CONFIG.REINVEST_AGENT_COST, payload:{ agent_type:this._pickAgentType(), specialization:this._pickSpecialization(), initial_budget:CONFIG.REINVEST_AGENT_COST }, status:'planned' }); }
    actions.push({ id:uuidv4(), type:'scale_infrastructure', priority:'medium', cost:cycle.allocations.infrastructure.amount, payload:{ targets:['cloudflare_workers','d1_databases','r2_storage'], upgrade_type:'capacity_expansion' }, status:'planned' });
    return actions;
  }
  _pickAgentType(){ const opts=['voice_ai_specialist','financial_analyzer','genealogy_researcher','customer_engagement','infrastructure_monitor','revenue_optimizer']; return opts[Math.floor(Math.random()*opts.length)]; }
  _pickSpecialization(){ const opts=['family_genealogy_reports','conversational_ai_interactions','automated_income_generation','system_optimization','customer_acquisition','data_analysis_insights']; return opts[Math.floor(Math.random()*opts.length)]; }
  async _latestPlanned(){ const cycles = await safeLoadJSON(CONFIG.REINVEST_FILE,{cycles:[]}); return cycles.cycles.filter(c=>c.status==='planned').sort((a,b)=> new Date(b.created_at)-new Date(a.created_at))[0] || null; }
  async executeReinvestmentCycle(cycleId){
    let cycle; if(cycleId){ const cycles=await safeLoadJSON(CONFIG.REINVEST_FILE,{cycles:[]}); cycle=cycles.cycles.find(c=>c.id===cycleId); if(!cycle) throw new Error('Cycle not found'); }
    if(!cycle){ cycle = await this._latestPlanned(); if(!cycle){ cycle = await this.evaluateReinvestmentCycle(); if(!cycle) return null; } }
    await this.addTransaction('reinvestment', cycle.reinvest_amount, `Reinvestment cycle ${cycle.id.slice(0,8)}`, { cycle_id: cycle.id });
    const jobs = new JobsManager(); let queued=0;
    for(const action of cycle.actions){ try{ const job = await jobs.enqueue({ type:action.type, priority:action.priority, payload:action.payload, cost:action.cost, cycle_id:cycle.id, action_id:action.id }); action.status='queued'; action.job_id=job.id; queued++; } catch(e){ action.status='failed'; action.error=e.message; } }
    cycle.status = queued>0 ? 'executing':'failed'; cycle.executed_at=new Date().toISOString(); cycle.executed_actions=queued;
    const all = await safeLoadJSON(CONFIG.REINVEST_FILE,{cycles:[]}); const idx = all.cycles.findIndex(c=>c.id===cycle.id); if(idx>=0) all.cycles[idx]=cycle; await safeWriteJSON(CONFIG.REINVEST_FILE, all); return cycle;
  }
  async autoFlow(){ const cycle = await this.evaluateReinvestmentCycle(); if(!cycle) return null; if(CONFIG.INVESTMENT_AUTO_EXECUTE) return this.executeReinvestmentCycle(cycle.id); return cycle; }
  // Bridge: ingest a wallet transaction from crypto-ledger and reflect as revenue.
  async ingestWalletTransaction(tx){ if(!tx || !tx.amount) return null; return this.addTransaction('revenue', tx.amount, `Wallet income ${tx.currency}`, { wallet_id: tx.wallet_id, source_agent: tx.agent, original_tx: tx.id }); }
  async systemStatus(){ const summary = await this.getFinancialSummary(); const cycles = await safeLoadJSON(CONFIG.REINVEST_FILE,{cycles:[]}); const jobs= await safeLoadJSON(CONFIG.JOBS_FILE,{jobs:[]}); return { summary, reinvest_cycles: cycles.cycles.length, queued_jobs: jobs.jobs.filter(j=>j.status==='queued').length, executing_cycles: cycles.cycles.filter(c=>c.status==='executing').length }; }
}

// Simple job executor simulation (exported for server integration)
async function executeJobSimulation(job){
  await new Promise(r=>setTimeout(r, 200 + Math.random()*400));
  if(job.type === 'spawn_agent'){
    return { success:true, result:{ agent_id:`agent_${Date.now()}_${Math.random().toString(36).slice(2,6)}`, type: job.payload.agent_type, specialization: job.payload.specialization, created_at:new Date().toISOString(), performance:{ efficiency: +(0.8+Math.random()*0.2).toFixed(2) } } };
  } else if(job.type === 'scale_infrastructure'){
    return { success:true, result:{ scaling_id:`scale_${Date.now()}`, targets: job.payload.targets, upgrade_type: job.payload.upgrade_type, improvement:'25-40%' } };
  }
  return { success: Math.random()>0.1, result:{ generic:true } };
}

module.exports = { AutonomousReinvestmentEngine, JobsManager, executeJobSimulation, CONFIG };

// CLI interface
if(require.main === module){
  (async ()=>{
    const engine = new AutonomousReinvestmentEngine();
    const [,,cmd,...args] = process.argv;
    try {
      switch(cmd){
        case 'status': return console.log(await engine.systemStatus());
        case 'add-revenue': return console.log(await engine.addTransaction('revenue', parseFloat(args[0]), args.slice(1).join(' ')||'CLI Revenue')); 
        case 'reinvest:evaluate': return console.log(await engine.evaluateReinvestmentCycle());
        case 'reinvest:execute': return console.log(await engine.executeReinvestmentCycle(args[0]));
        case 'reinvest:auto': return console.log(await engine.autoFlow());
        default: console.log('Commands: status | add-revenue <amount> [desc] | reinvest:evaluate | reinvest:execute [cycleId] | reinvest:auto');
      }
    } catch(e){ console.error('Error:', e.message); process.exit(1); }
  })();
}
