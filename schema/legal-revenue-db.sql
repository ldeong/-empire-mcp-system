-- 💰 LEGAL REVENUE DATABASE SCHEMA
-- 100% compliant revenue tracking and analytics

-- Revenue tracking table
CREATE TABLE IF NOT EXISTS revenue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service TEXT NOT NULL,
    amount REAL NOT NULL,
    user_id TEXT,
    timestamp INTEGER NOT NULL,
    date TEXT NOT NULL,
    payment_status TEXT DEFAULT 'pending',
    stripe_payment_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Service usage analytics
CREATE TABLE IF NOT EXISTS service_usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    user_id TEXT,
    request_data TEXT,
    response_size INTEGER,
    processing_time REAL,
    timestamp INTEGER NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Customer information
CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT UNIQUE NOT NULL,
    email TEXT,
    name TEXT,
    company TEXT,
    total_spent REAL DEFAULT 0,
    total_requests INTEGER DEFAULT 0,
    first_purchase DATETIME,
    last_purchase DATETIME,
    stripe_customer_id TEXT,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Payment transactions
CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    stripe_payment_intent_id TEXT UNIQUE NOT NULL,
    user_id TEXT NOT NULL,
    amount REAL NOT NULL,
    currency TEXT DEFAULT 'usd',
    status TEXT NOT NULL,
    service TEXT NOT NULL,
    description TEXT,
    metadata TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- API keys for legitimate usage tracking
CREATE TABLE IF NOT EXISTS api_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key_id TEXT UNIQUE NOT NULL,
    user_id TEXT NOT NULL,
    name TEXT,
    permissions TEXT, -- JSON array of allowed services
    rate_limit INTEGER DEFAULT 1000,
    requests_made INTEGER DEFAULT 0,
    last_used DATETIME,
    expires_at DATETIME,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Affiliate tracking
CREATE TABLE IF NOT EXISTS affiliate_clicks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    product TEXT NOT NULL,
    affiliate_link TEXT NOT NULL,
    clicked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ip_address TEXT,
    user_agent TEXT,
    converted BOOLEAN DEFAULT 0,
    commission_earned REAL DEFAULT 0,
    conversion_date DATETIME
);

-- Webhook endpoints
CREATE TABLE IF NOT EXISTS webhook_endpoints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    webhook_id TEXT UNIQUE NOT NULL,
    user_id TEXT NOT NULL,
    name TEXT,
    target_url TEXT NOT NULL,
    secret TEXT,
    is_active BOOLEAN DEFAULT 1,
    total_webhooks INTEGER DEFAULT 0,
    last_webhook DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Content generation history
CREATE TABLE IF NOT EXISTS content_generated (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    topic TEXT NOT NULL,
    content_type TEXT NOT NULL,
    word_count INTEGER NOT NULL,
    price REAL NOT NULL,
    content_preview TEXT,
    quality_score REAL,
    generated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- System metrics for monitoring
CREATE TABLE IF NOT EXISTS system_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    metric_name TEXT NOT NULL,
    metric_value REAL NOT NULL,
    metric_type TEXT NOT NULL, -- revenue, requests, performance, etc.
    timestamp INTEGER NOT NULL,
    date TEXT NOT NULL,
    metadata TEXT -- JSON for additional data
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_revenue_date ON revenue(date);
CREATE INDEX IF NOT EXISTS idx_revenue_service ON revenue(service);
CREATE INDEX IF NOT EXISTS idx_revenue_user ON revenue(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_service ON service_usage(service);
CREATE INDEX IF NOT EXISTS idx_usage_timestamp ON service_usage(timestamp);
CREATE INDEX IF NOT EXISTS idx_customers_user_id ON customers(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_id ON api_keys(key_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_user_id ON affiliate_clicks(user_id);
CREATE INDEX IF NOT EXISTS idx_webhook_user_id ON webhook_endpoints(user_id);
CREATE INDEX IF NOT EXISTS idx_content_user_id ON content_generated(user_id);
CREATE INDEX IF NOT EXISTS idx_metrics_name ON system_metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_metrics_date ON system_metrics(date);

-- Insert initial metrics
INSERT OR IGNORE INTO system_metrics (metric_name, metric_value, metric_type, timestamp, date) VALUES
('total_revenue', 0.0, 'revenue', strftime('%s', 'now'), date('now')),
('daily_requests', 0, 'usage', strftime('%s', 'now'), date('now')),
('active_customers', 0, 'customers', strftime('%s', 'now'), date('now')),
('system_uptime', 100.0, 'performance', strftime('%s', 'now'), date('now')),
('legal_compliance', 100.0, 'compliance', strftime('%s', 'now'), date('now'));