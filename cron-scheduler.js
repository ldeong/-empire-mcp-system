// Cron Scheduler & Accountability Layer
// Provides: job registry, execution logging, retry logic, daily/weekly summary scaffolding.
// Lightweight implementation using setInterval rather than external cron dependency (can swap to node-cron later).

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { getCronConfig } = require('./config-resolver');

const CRON_CONFIG = getCronConfig();

function ensureDir(dir){ if(!fs.existsSync(dir)) fs.mkdirSync(dir,{recursive:true}); }
function loadJSON(file, def){ try { return JSON.parse(fs.readFileSync(file,'utf8')); } catch(e){ if(e.code==='ENOENT'){ fs.writeFileSync(file, JSON.stringify(def,null,2)); return def;} throw e; } }
function saveJSON(file, data){ fs.writeFileSync(file, JSON.stringify(data,null,2)); }

class CronScheduler {
  constructor(){
    ensureDir(CRON_CONFIG.DATA_DIR);
    this.runs = loadJSON(CRON_CONFIG.RUNS_FILE, { runs: [] });
    this.jobs = {}; // id -> definition
    this.intervals = {}; // id -> timer
  }

  registerJob({ id, name, scheduleSeconds, expectedRuntimeSec=30, handler, kpiSchema }){
    if(this.jobs[id]) throw new Error(`Cron job already registered: ${id}`);
    this.jobs[id] = { id, name, scheduleSeconds, expectedRuntimeSec, handler, kpiSchema };
    if(CRON_CONFIG.ENABLE){
      this._startInterval(id);
    }
    return this.jobs[id];
  }

  _startInterval(id){
    const job = this.jobs[id];
    if(!job) return;
    if(this.intervals[id]) clearInterval(this.intervals[id]);
    this.intervals[id] = setInterval(()=> this.runJob(id,'scheduled'), job.scheduleSeconds*1000);
  }

  listJobs(){
    return Object.values(this.jobs).map(j=>({ id:j.id, name:j.name, scheduleSeconds:j.scheduleSeconds, expectedRuntimeSec:j.expectedRuntimeSec }));
  }

  async runJob(id, trigger='manual'){
    const job = this.jobs[id];
    if(!job) throw new Error('Job not found');
    const runId = uuidv4();
    const start = Date.now();
    let attempts = 0; let success=false; let error=null; let kpis={};
    while(attempts < CRON_CONFIG.MAX_RETRIES && !success){
      attempts++;
      try {
        const result = await Promise.resolve(job.handler({ runId, trigger }));
        kpis = result && typeof result === 'object' ? result : {};
        success = true;
      } catch(e){
        error = e.message;
        if(attempts >= CRON_CONFIG.MAX_RETRIES) break;
      }
    }
    const duration = +( (Date.now()-start)/1000 ).toFixed(2);
    const runRecord = { id: runId, job_id:id, name: job.name, trigger, attempts, success, error, kpis, started_at: new Date(start).toISOString(), duration_sec: duration, status: success? 'success':'failed' };
    this.runs.runs.push(runRecord);
    if(this.runs.runs.length > 5000){ this.runs.runs = this.runs.runs.slice(-4000); }
    saveJSON(CRON_CONFIG.RUNS_FILE, this.runs);
    return runRecord;
  }

  getRecentRuns(limit=50){ return this.runs.runs.slice(-limit).reverse(); }
  getStats(){
    const runs = this.runs.runs;
    const total = runs.length; const failures = runs.filter(r=>!r.success).length;
    const failRate = total? +(failures/total*100).toFixed(2):0;
    return { total_runs: total, failures, fail_rate_percent: failRate, jobs_registered: Object.keys(this.jobs).length };
  }
}

// Default singleton pattern
let schedulerInstance=null;
function getScheduler(){ if(!schedulerInstance) schedulerInstance = new CronScheduler(); return schedulerInstance; }

module.exports = { CronScheduler, getScheduler, CRON_CONFIG };
