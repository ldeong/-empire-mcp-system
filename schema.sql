-- D1 Database Schema for Income Empire
CREATE TABLE transactions (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  amount REAL NOT NULL,
  status TEXT DEFAULT 'pending',
  gateway TEXT DEFAULT 'stripe',
  customer_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME
);

CREATE TABLE jobs (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  pay REAL NOT NULL,
  difficulty TEXT DEFAULT 'easy',
  status TEXT DEFAULT 'available',
  claimed_by TEXT,
  claimed_at DATETIME,
  completed_at DATETIME,
  proof TEXT,
  escrow_id TEXT
);

CREATE TABLE api_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  endpoint TEXT NOT NULL,
  revenue REAL NOT NULL,
  cost REAL DEFAULT 0,
  profit REAL GENERATED ALWAYS AS (revenue - cost) STORED,
  customer_ip TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE affiliates (
  id TEXT PRIMARY KEY,
  service TEXT NOT NULL,
  category TEXT DEFAULT 'hosting',
  clicks INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  revenue REAL DEFAULT 0,
  commission_rate REAL DEFAULT 0.3,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE escrow (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  amount REAL NOT NULL,
  status TEXT DEFAULT 'held',
  released_to TEXT,
  released_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (job_id) REFERENCES jobs(id)
);

CREATE TABLE revenue_streams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stream_type TEXT NOT NULL,
  daily_revenue REAL DEFAULT 0,
  monthly_revenue REAL DEFAULT 0,
  total_revenue REAL DEFAULT 0,
  active BOOLEAN DEFAULT TRUE,
  last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE auto_scaling (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  resource_type TEXT NOT NULL,
  current_capacity INTEGER DEFAULT 1,
  target_capacity INTEGER DEFAULT 1,
  cost_per_unit REAL NOT NULL,
  revenue_threshold REAL NOT NULL,
  last_scaled DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_created ON transactions(created_at);
CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_pay ON jobs(pay DESC);
CREATE INDEX idx_api_usage_timestamp ON api_usage(timestamp);
CREATE INDEX idx_api_usage_endpoint ON api_usage(endpoint);
CREATE INDEX idx_affiliates_service ON affiliates(service);
CREATE INDEX idx_escrow_status ON escrow(status);

-- Initialize revenue streams
INSERT INTO revenue_streams (stream_type, active) VALUES 
('micro_services', TRUE),
('job_automation', TRUE),
('affiliate_marketing', TRUE),
('api_monetization', TRUE);

-- Initialize auto-scaling resources
INSERT INTO auto_scaling (resource_type, cost_per_unit, revenue_threshold) VALUES
('api_workers', 10.00, 100.00),
('storage_gb', 5.00, 50.00),
('compute_units', 20.00, 200.00),
('domain_names', 15.00, 150.00);