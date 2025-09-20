-- ============================================
-- SINA EMPIRE ESCROW AUTOMATION DATABASE
-- Complete schema for autonomous job completion
-- ============================================

-- Escrow Jobs Table
CREATE TABLE IF NOT EXISTS escrow_jobs (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  description TEXT NOT NULL,
  amount REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_deposit',
  created_at INTEGER NOT NULL,
  deadline INTEGER NOT NULL,
  client TEXT NOT NULL,
  worker TEXT,
  claimed_at INTEGER,
  completed_at INTEGER,
  released_at INTEGER,
  proof TEXT,
  source TEXT DEFAULT 'internal'
);

CREATE INDEX idx_escrow_status ON escrow_jobs(status);
CREATE INDEX idx_escrow_amount ON escrow_jobs(amount DESC);
CREATE INDEX idx_escrow_deadline ON escrow_jobs(deadline);

-- Transactions Table
CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  amount REAL NOT NULL,
  recipient TEXT,
  sender TEXT,
  job_id TEXT,
  status TEXT DEFAULT 'completed',
  timestamp INTEGER NOT NULL,
  description TEXT,
  FOREIGN KEY (job_id) REFERENCES escrow_jobs(id)
);

CREATE INDEX idx_transactions_type ON transactions(type);
CREATE INDEX idx_transactions_timestamp ON transactions(timestamp DESC);

-- Worker Balances Table
CREATE TABLE IF NOT EXISTS worker_balances (
  worker_id TEXT PRIMARY KEY,
  balance REAL DEFAULT 0,
  total_earned REAL DEFAULT 0,
  jobs_completed INTEGER DEFAULT 0,
  last_activity INTEGER,
  rating REAL DEFAULT 5.0
);

-- Scaling Log Table
CREATE TABLE IF NOT EXISTS scaling_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  cost REAL NOT NULL,
  reason TEXT,
  timestamp INTEGER NOT NULL,
  success BOOLEAN DEFAULT TRUE
);

CREATE INDEX idx_scaling_timestamp ON scaling_log(timestamp DESC);

-- Auto-Purchase Rules Table
CREATE TABLE IF NOT EXISTS auto_purchase_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rule_type TEXT NOT NULL,
  trigger_condition TEXT NOT NULL,
  trigger_value REAL NOT NULL,
  purchase_type TEXT NOT NULL,
  purchase_quantity INTEGER NOT NULL,
  max_cost REAL NOT NULL,
  enabled BOOLEAN DEFAULT TRUE,
  created_at INTEGER NOT NULL
);

-- Insert default auto-purchase rules
INSERT OR IGNORE INTO auto_purchase_rules (
  rule_type, trigger_condition, trigger_value, 
  purchase_type, purchase_quantity, max_cost, created_at
) VALUES 
  ('earnings', 'balance_threshold', 100.0, 'api_keys', 1, 20.0, unixepoch()),
  ('jobs', 'completion_rate', 90.0, 'worker_capacity', 1, 50.0, unixepoch()),
  ('scaling_fund', 'amount_threshold', 50.0, 'cloudflare_workers', 10, 30.0, unixepoch()),
  ('performance', 'requests_per_second', 100.0, 'cdn_bandwidth', 1, 25.0, unixepoch());

-- Job Templates Table
CREATE TABLE IF NOT EXISTS job_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  template_name TEXT NOT NULL,
  job_type TEXT NOT NULL,
  description_template TEXT NOT NULL,
  default_price REAL NOT NULL,
  estimated_time INTEGER NOT NULL, -- in seconds
  ai_completion_prompt TEXT,
  success_criteria TEXT,
  auto_completable BOOLEAN DEFAULT FALSE
);

-- Insert default job templates
INSERT OR IGNORE INTO job_templates (
  template_name, job_type, description_template, default_price, 
  estimated_time, ai_completion_prompt, auto_completable
) VALUES 
  ('Basic Data Entry', 'data-entry', 'Enter {count} records into spreadsheet', 5.0, 300, 'Process the provided data and format as requested', TRUE),
  ('Content Writing', 'content-writing', 'Write {word_count} word article about {topic}', 25.0, 1800, 'Write engaging content on the given topic', TRUE),
  ('API Testing', 'api-testing', 'Test {endpoint_count} API endpoints for functionality', 10.0, 600, 'Test all endpoints and document results', TRUE),
  ('Email Validation', 'data-validation', 'Validate {email_count} email addresses', 2.0, 180, 'Verify email format and deliverability', TRUE),
  ('Social Media Posts', 'content-creation', 'Create {post_count} social media posts for {platform}', 15.0, 900, 'Create engaging social media content', TRUE);

-- Performance Metrics Table
CREATE TABLE IF NOT EXISTS performance_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp INTEGER NOT NULL,
  metric_type TEXT NOT NULL,
  metric_value REAL NOT NULL,
  job_id TEXT,
  worker_id TEXT
);

CREATE INDEX idx_metrics_timestamp ON performance_metrics(timestamp DESC);
CREATE INDEX idx_metrics_type ON performance_metrics(metric_type);

-- Revenue Streams Table
CREATE TABLE IF NOT EXISTS revenue_streams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stream_name TEXT NOT NULL,
  stream_type TEXT NOT NULL,
  hourly_rate REAL,
  commission_rate REAL,
  total_earned REAL DEFAULT 0,
  last_earning INTEGER,
  enabled BOOLEAN DEFAULT TRUE
);

-- Insert revenue streams
INSERT OR IGNORE INTO revenue_streams (
  stream_name, stream_type, hourly_rate, commission_rate, enabled
) VALUES 
  ('Escrow Job Completion', 'job-based', 85.0, 0.15, TRUE),
  ('API Service Resale', 'service-based', 120.0, 0.30, TRUE),
  ('Data Processing', 'volume-based', 95.0, 0.20, TRUE),
  ('Content Generation', 'word-based', 0.08, 0.25, TRUE),
  ('Automated Testing', 'task-based', 110.0, 0.18, TRUE);

-- Wallet Addresses Table
CREATE TABLE IF NOT EXISTS wallet_addresses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  currency TEXT NOT NULL,
  address TEXT NOT NULL,
  label TEXT,
  is_primary BOOLEAN DEFAULT FALSE,
  created_at INTEGER NOT NULL
);

-- Insert wallet addresses
INSERT OR IGNORE INTO wallet_addresses (currency, address, label, is_primary, created_at) VALUES 
  ('MONERO', '47gYaGWWfQF4J2VUGekPDqMC2WX7uT7LH3h8a3TQnLaZUfgJTQhJ1F7nN8n2DdMhfWP5KG9HnX4VzV8N9qE4cGzz5cNgYxQ', 'Primary Monero Wallet', TRUE, unixepoch()),
  ('BITCOIN', 'bc1qescrow123456789abcdef', 'Bitcoin Receiving', FALSE, unixepoch()),
  ('ETHEREUM', '0x742d35Cc6AbCdEf123456789', 'Ethereum Smart Contract', FALSE, unixepoch());

-- API Keys Management Table
CREATE TABLE IF NOT EXISTS api_keys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL,
  key_name TEXT NOT NULL,
  key_value TEXT NOT NULL,
  usage_limit INTEGER,
  usage_count INTEGER DEFAULT 0,
  cost_per_use REAL DEFAULT 0,
  monthly_cost REAL DEFAULT 0,
  created_at INTEGER NOT NULL,
  expires_at INTEGER,
  enabled BOOLEAN DEFAULT TRUE
);

-- Insert demo API keys
INSERT OR IGNORE INTO api_keys (
  provider, key_name, key_value, usage_limit, monthly_cost, created_at, enabled
) VALUES 
  ('OpenAI', 'GPT-4 Content Generation', 'sk-demo-key-content', 1000000, 20.0, unixepoch(), TRUE),
  ('RapidAPI', 'Data Validation Hub', 'rapid-demo-validation', 500000, 10.0, unixepoch(), TRUE),
  ('Stripe', 'Payment Processing', 'sk_live_demo_payments', NULL, 0.0, unixepoch(), TRUE),
  ('CloudFlare', 'Workers API', 'cf-demo-workers', 100000, 5.0, unixepoch(), TRUE);

-- Autonomous Settings Table
CREATE TABLE IF NOT EXISTS autonomous_settings (
  setting_key TEXT PRIMARY KEY,
  setting_value TEXT NOT NULL,
  setting_type TEXT NOT NULL DEFAULT 'string',
  description TEXT,
  updated_at INTEGER NOT NULL
);

-- Insert autonomous settings
INSERT OR IGNORE INTO autonomous_settings (setting_key, setting_value, setting_type, description, updated_at) VALUES 
  ('auto_claim_jobs', 'true', 'boolean', 'Automatically claim profitable jobs', unixepoch()),
  ('auto_complete_jobs', 'true', 'boolean', 'Auto-complete jobs using AI', unixepoch()),
  ('auto_release_escrow', 'true', 'boolean', 'Auto-release funds on completion', unixepoch()),
  ('auto_reinvest_percentage', '30', 'number', 'Percentage of earnings to reinvest', unixepoch()),
  ('min_profit_margin', '50', 'number', 'Minimum profit margin percentage', unixepoch()),
  ('max_concurrent_jobs', '10', 'number', 'Maximum jobs to work on simultaneously', unixepoch()),
  ('scaling_threshold', '100', 'number', 'Earnings threshold to trigger scaling', unixepoch()),
  ('target_daily_earnings', '500', 'number', 'Daily earnings target in USD', unixepoch());

-- Job Queue Table (for managing job processing)
CREATE TABLE IF NOT EXISTS job_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id TEXT NOT NULL,
  priority INTEGER DEFAULT 1,
  status TEXT DEFAULT 'queued',
  scheduled_at INTEGER NOT NULL,
  started_at INTEGER,
  completed_at INTEGER,
  worker_assigned TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  error_message TEXT
);

CREATE INDEX idx_queue_priority ON job_queue(priority DESC, scheduled_at ASC);
CREATE INDEX idx_queue_status ON job_queue(status);

-- Daily Statistics View
CREATE VIEW IF NOT EXISTS daily_stats AS
SELECT 
  DATE(created_at, 'unixepoch') as date,
  COUNT(*) as jobs_created,
  COUNT(CASE WHEN status = 'funds_released' THEN 1 END) as jobs_completed,
  SUM(CASE WHEN status = 'funds_released' THEN amount ELSE 0 END) as earnings,
  AVG(CASE WHEN status = 'funds_released' THEN amount ELSE NULL END) as avg_job_value,
  SUM(CASE WHEN status = 'funds_released' THEN (completed_at - claimed_at) ELSE NULL END) / 
    COUNT(CASE WHEN status = 'funds_released' THEN 1 END) as avg_completion_time_seconds
FROM escrow_jobs 
GROUP BY DATE(created_at, 'unixepoch')
ORDER BY date DESC;

-- Performance Summary View
CREATE VIEW IF NOT EXISTS performance_summary AS
SELECT 
  COUNT(*) as total_jobs,
  COUNT(CASE WHEN status = 'funds_released' THEN 1 END) as completed_jobs,
  ROUND(COUNT(CASE WHEN status = 'funds_released' THEN 1 END) * 100.0 / COUNT(*), 2) as completion_rate,
  SUM(CASE WHEN status = 'funds_released' THEN amount ELSE 0 END) as total_earnings,
  SUM(CASE WHEN status = 'funds_released' THEN amount * 0.15 ELSE 0 END) as platform_fees,
  COUNT(CASE WHEN status IN ('pending_deposit', 'funded', 'in_progress') THEN 1 END) as active_jobs,
  AVG(CASE WHEN status = 'funds_released' THEN amount ELSE NULL END) as avg_job_value
FROM escrow_jobs;

-- Initialize sample data for testing
INSERT OR IGNORE INTO escrow_jobs (
  id, type, description, amount, status, created_at, deadline, client
) VALUES 
  ('demo_job_1', 'content-writing', 'Write 500-word blog post about AI automation', 25.0, 'funded', unixepoch() - 3600, unixepoch() + 86400, 'demo_client'),
  ('demo_job_2', 'data-entry', 'Process 100 customer records', 15.0, 'funded', unixepoch() - 1800, unixepoch() + 43200, 'demo_client'),
  ('demo_job_3', 'api-testing', 'Test payment gateway endpoints', 35.0, 'in_progress', unixepoch() - 900, unixepoch() + 28800, 'demo_client');

-- Trigger automatic job claiming for funded jobs
INSERT OR IGNORE INTO job_queue (job_id, priority, scheduled_at) 
SELECT id, 1, unixepoch() 
FROM escrow_jobs 
WHERE status = 'funded' 
AND id NOT IN (SELECT job_id FROM job_queue);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_jobs_worker ON escrow_jobs(worker);
CREATE INDEX IF NOT EXISTS idx_jobs_created ON escrow_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_queue_worker ON job_queue(worker_assigned);

-- Set initial scaling fund
INSERT OR IGNORE INTO transactions (type, amount, recipient, timestamp, description) 
VALUES ('initial_fund', 0.0, 'scaling_fund', unixepoch(), 'Initial scaling fund setup');

PRAGMA optimize;