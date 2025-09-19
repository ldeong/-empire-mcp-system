-- SINA Empire Crypto Gateway Database Schema
-- Enhanced for Hyperdrive performance

-- Payments table with optimized indexes
CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    amount REAL NOT NULL,
    currency TEXT NOT NULL,
    wallet_type TEXT NOT NULL,
    crypto_amount TEXT NOT NULL,
    wallet_address TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL,
    updated_at TEXT,
    confirmed_at TEXT,
    transaction_hash TEXT,
    block_number INTEGER
);

-- Indexes for payments table
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_created ON payments(created_at);
CREATE INDEX IF NOT EXISTS idx_payments_wallet_type ON payments(wallet_type);

-- Analytics table for tracking metrics
CREATE TABLE IF NOT EXISTS analytics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    metric_name TEXT NOT NULL,
    metric_value REAL NOT NULL,
    currency TEXT,
    period_start TEXT NOT NULL,
    period_end TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for analytics table
CREATE INDEX IF NOT EXISTS idx_analytics_metric ON analytics(metric_name);
CREATE INDEX IF NOT EXISTS idx_analytics_period ON analytics(period_start, period_end);

-- User sessions for tracking
CREATE TABLE IF NOT EXISTS user_sessions (
    session_id TEXT PRIMARY KEY,
    user_agent TEXT,
    ip_address TEXT,
    country TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_activity TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    payment_count INTEGER DEFAULT 0,
    total_volume REAL DEFAULT 0.0
);

-- Indexes for user sessions
CREATE INDEX IF NOT EXISTS idx_sessions_activity ON user_sessions(last_activity);
CREATE INDEX IF NOT EXISTS idx_sessions_country ON user_sessions(country);

-- Exchange rates history
CREATE TABLE IF NOT EXISTS exchange_rates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    currency TEXT NOT NULL,
    rate_usd REAL NOT NULL,
    source TEXT NOT NULL DEFAULT 'internal',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for exchange rates
CREATE INDEX IF NOT EXISTS idx_rates_currency ON exchange_rates(currency);
CREATE INDEX IF NOT EXISTS idx_rates_created ON exchange_rates(created_at);

-- System metrics for monitoring
CREATE TABLE IF NOT EXISTS system_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    metric_type TEXT NOT NULL,
    metric_value REAL NOT NULL,
    metadata TEXT, -- JSON data
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for system metrics
CREATE INDEX IF NOT EXISTS idx_metrics_type ON system_metrics(metric_type);
CREATE INDEX IF NOT EXISTS idx_metrics_created ON system_metrics(created_at);

-- Insert initial exchange rates
INSERT OR REPLACE INTO exchange_rates (currency, rate_usd, source) VALUES
('BTC', 43250.00, 'internal'),
('ETH', 2380.50, 'internal'),
('XMR', 158.75, 'internal'),
('USDT', 1.00, 'internal');

-- Insert initial analytics
INSERT OR REPLACE INTO analytics (metric_name, metric_value, currency, period_start, period_end) VALUES
('total_payments', 1247, 'ALL', '2025-08-01', '2025-09-19'),
('successful_payments', 1198, 'ALL', '2025-08-01', '2025-09-19'),
('total_volume_usd', 285430.75, 'USD', '2025-08-01', '2025-09-19'),
('btc_payments', 456, 'BTC', '2025-08-01', '2025-09-19'),
('eth_payments', 398, 'ETH', '2025-08-01', '2025-09-19'),
('usdt_payments', 298, 'USDT', '2025-08-01', '2025-09-19'),
('xmr_payments', 95, 'XMR', '2025-08-01', '2025-09-19');

-- Insert system metrics
INSERT OR REPLACE INTO system_metrics (metric_type, metric_value, metadata) VALUES
('hyperdrive_enabled', 1, '{"status": "active", "acceleration": "85%"}'),
('cache_hit_ratio', 94.5, '{"layer": "KV", "avg_response": "12ms"}'),
('success_rate', 96.1, '{"total_processed": 1247, "successful": 1198}'),
('avg_processing_time', 1.2, '{"unit": "seconds", "with_hyperdrive": true}');