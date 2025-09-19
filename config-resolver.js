// Config Resolver: Backward-compatible mapping layer
// Ensures existing deployments continue working while migrating to standardized env variable names
// Priority: new standard names > legacy names > defaults

const ENV_MAPPING = {
  // File path mappings (new -> legacy fallbacks)
  'FINANCIAL_LEDGER_FILE': ['LEDGER_FILE', 'LOCAL_LEDGER_FILE'],
  'JOBS_QUEUE_FILE': ['JOB_QUEUE_FILE', 'JOBS_FILE'],
  'REINVEST_CYCLES_FILE': ['REINVEST_FILE'],
  'ACTIVE_AGENTS_FILE': ['AGENTS_FILE'],
  'CRON_RUNS_FILE': [],
  'LEADS_LEDGER_FILE': [],
  
  // Threshold & cost mappings
  'REINVEST_THRESHOLD': ['REINVEST_MIN_THRESHOLD'],
  'REINVEST_AGENT_COST': [],
  'MAX_AUTO_AGENTS': [],
  
  // Allocation mappings (new fractional -> old percentage)
  'AGENT_SPAWN_ALLOCATION': ['REINVEST_SCALE_PERCENT'], // 0.6 <-> 60
  'INFRASTRUCTURE_ALLOCATION': ['REINVEST_INFRA_PERCENT'], // 0.3 <-> 30
  'RESERVES_ALLOCATION': ['REINVEST_RESERVE_PERCENT'], // 0.1 <-> 10
  
  // Feature toggle mappings
  'INVESTMENT_AUTO_EXECUTE': [],
  'ENABLE_CRON_SCHEDULER': [],
  'ENABLE_REAL_INCOME_MODE': [],
  
  // Wallet & blockchain mappings
  'WALLET_MASTER_KEY': ['WALLET_MASTER_PASSPHRASE'],
  'BTC_NETWORK': [],
  'ETHERSCAN_API_KEY': [],
  'BLOCKSTREAM_API_BASE': [],
};

function resolveConfig(key, defaultValue = null) {
  // Try primary env variable first
  if (process.env[key] !== undefined) {
    return parseEnvValue(process.env[key]);
  }
  
  // Try legacy fallbacks
  const fallbacks = ENV_MAPPING[key] || [];
  for (const fallback of fallbacks) {
    if (process.env[fallback] !== undefined) {
      const value = process.env[fallback];
      
      // Handle percentage -> fraction conversion for allocations
      if (key.includes('_ALLOCATION') && fallback.includes('_PERCENT')) {
        return parseFloat(value) / 100;
      }
      
      return parseEnvValue(value);
    }
  }
  
  return defaultValue;
}

function parseEnvValue(value) {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^\d+$/.test(value)) return parseInt(value);
  if (/^\d*\.\d+$/.test(value)) return parseFloat(value);
  return value;
}

// Generate unified config object for autonomous engine
function getAutonomousConfig() {
  return {
    DATA_DIR: resolveConfig('DATA_DIR', './data'),
    LEDGER_FILE: resolveConfig('FINANCIAL_LEDGER_FILE', './data/financial-ledger.json'),
    REINVEST_FILE: resolveConfig('REINVEST_CYCLES_FILE', './data/reinvestment-cycles.json'),
    JOBS_FILE: resolveConfig('JOBS_QUEUE_FILE', './data/jobs.json'),
    AGENTS_FILE: resolveConfig('ACTIVE_AGENTS_FILE', './data/active-agents.json'),
    
    // Core thresholds & costs
    INVESTMENT_AUTO_EXECUTE: resolveConfig('INVESTMENT_AUTO_EXECUTE', false),
    REINVEST_AGENT_COST: resolveConfig('REINVEST_AGENT_COST', 5),
    MAX_AUTO_AGENTS: resolveConfig('MAX_AUTO_AGENTS', 25),
    REINVEST_THRESHOLD: resolveConfig('REINVEST_THRESHOLD', 100),
    
    // Allocation fractions (0..1)
    AGENT_SPAWN_ALLOCATION: resolveConfig('AGENT_SPAWN_ALLOCATION', 0.6),
    INFRASTRUCTURE_ALLOCATION: resolveConfig('INFRASTRUCTURE_ALLOCATION', 0.3),
    RESERVES_ALLOCATION: resolveConfig('RESERVES_ALLOCATION', 0.1),
    
    MAX_JOB_ATTEMPTS: resolveConfig('MAX_JOB_ATTEMPTS', 3),
  };
}

// Generate unified config object for cron scheduler
function getCronConfig() {
  return {
    ENABLE: resolveConfig('ENABLE_CRON_SCHEDULER', true),
    TIMEZONE: resolveConfig('CRON_TIMEZONE', 'UTC'),
    MAX_RETRIES: resolveConfig('MAX_CRON_RETRIES', 3),
    DATA_DIR: resolveConfig('DATA_DIR', './data'),
    RUNS_FILE: resolveConfig('CRON_RUNS_FILE', './data/cron-runs.json'),
    DAILY_SUMMARY_HOUR: resolveConfig('CRON_DAILY_SUMMARY_HOUR', 23),
    WEEKLY_SUMMARY_DAY: resolveConfig('CRON_WEEKLY_SUMMARY_DAY', 0),
    LEADS_FILE: resolveConfig('LEADS_LEDGER_FILE', './data/leads-ledger.json')
  };
}

// Generate wallet config
function getWalletConfig() {
  return {
    MASTER_KEY: resolveConfig('WALLET_MASTER_KEY', 'change_this_wallet_master_key'),
    BTC_NETWORK: resolveConfig('BTC_NETWORK', 'testnet'),
    ETHERSCAN_API_KEY: resolveConfig('ETHERSCAN_API_KEY', ''),
    BLOCKSTREAM_API_BASE: resolveConfig('BLOCKSTREAM_API_BASE', 'https://blockstream.info/testnet/api'),
    ENABLE_REAL_INCOME_MODE: resolveConfig('ENABLE_REAL_INCOME_MODE', false),
    REQUIRE_TXID_FOR_REVENUE: resolveConfig('REQUIRE_TXID_FOR_REVENUE', true),
    MIN_BLOCK_CONFIRMATIONS: resolveConfig('MIN_BLOCK_CONFIRMATIONS', 1),
    ALLOW_PENDING_REVENUE: resolveConfig('ALLOW_PENDING_REVENUE', true),
  };
}

// Generate pipeline config
function getPipelineConfig() {
  return {
    MAX_BACKLOG: resolveConfig('LEADS_MAX_BACKLOG', 500),
    LEDGER_FILE: resolveConfig('LEADS_LEDGER_FILE', './data/leads-ledger.json'),
    QUALIFICATION_THRESHOLD: resolveConfig('LEAD_QUALIFICATION_THRESHOLD', 70),
    TOP_PERCENT_FLAG: resolveConfig('LEAD_TOP_PERCENT_FLAG', 20),
    KPI_INTERVAL_MIN: resolveConfig('PIPELINE_KPI_INTERVAL_MIN', 240),
  };
}

// Validate configuration coherence
function validateConfig() {
  const autoConfig = getAutonomousConfig();
  const allocSum = autoConfig.AGENT_SPAWN_ALLOCATION + autoConfig.INFRASTRUCTURE_ALLOCATION + autoConfig.RESERVES_ALLOCATION;
  
  const issues = [];
  if (Math.abs(allocSum - 1.0) > 0.01) {
    issues.push(`Allocation fractions sum to ${allocSum.toFixed(3)}, should be ~1.0`);
  }
  
  if (autoConfig.REINVEST_THRESHOLD <= 0) {
    issues.push('REINVEST_THRESHOLD must be positive');
  }
  
  if (autoConfig.REINVEST_AGENT_COST <= 0) {
    issues.push('REINVEST_AGENT_COST must be positive');
  }
  
  return issues;
}

module.exports = {
  resolveConfig,
  getAutonomousConfig,
  getCronConfig,
  getWalletConfig,
  getPipelineConfig,
  validateConfig,
  ENV_MAPPING
};