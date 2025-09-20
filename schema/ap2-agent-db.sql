-- ap2-agent-db.sql
-- Database schema for AP2 Agent System (D1)

-- Tenants are identified by AP2 Key ID (kid)
CREATE TABLE IF NOT EXISTS tenants (
	id INTEGER PRIMARY KEY,
	kid TEXT UNIQUE NOT NULL,
	display_name TEXT,
	balance_usd_cents INTEGER NOT NULL DEFAULT 0,
	created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS ap2_nonces (
	nonce TEXT PRIMARY KEY,
	kid TEXT NOT NULL,
	ts INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS services (
	id INTEGER PRIMARY KEY,
	name TEXT UNIQUE NOT NULL,
	base_url TEXT NOT NULL,
	rps_limit INTEGER NOT NULL,
	daily_quota INTEGER NOT NULL,
	vendor TEXT NOT NULL,
	vendor_plan TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS keys (
	id INTEGER PRIMARY KEY,
	service_id INTEGER NOT NULL REFERENCES services(id),
	alias TEXT NOT NULL,
	enc_key BLOB NOT NULL,
	status TEXT NOT NULL CHECK (status IN ('active','cooldown','revoked')),
	daily_used INTEGER NOT NULL DEFAULT 0,
	rps_window_count INTEGER NOT NULL DEFAULT 0,
	rps_window_reset_ms INTEGER NOT NULL DEFAULT 0,
	last_error_at INTEGER,
	created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS usage_log (
	id INTEGER PRIMARY KEY,
	ts INTEGER NOT NULL,
	kid TEXT NOT NULL,
	service_id INTEGER NOT NULL,
	key_id INTEGER,
	status_code INTEGER,
	success INTEGER NOT NULL,
	latency_ms INTEGER,
	units REAL,
	markup_usd REAL,
	cost_usd REAL
);

CREATE TABLE IF NOT EXISTS purchases (
	id INTEGER PRIMARY KEY,
	ts INTEGER NOT NULL,
	kid TEXT NOT NULL,
	service_id INTEGER,
	vendor TEXT NOT NULL,
	plan TEXT NOT NULL,
	amount_usd REAL NOT NULL,
	fee_usd REAL NOT NULL,
	receipt_url TEXT,
	status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
	k TEXT PRIMARY KEY,
	v TEXT NOT NULL
);

-- Seed default settings / feature flags
INSERT OR IGNORE INTO settings (k,v) VALUES
	('kill_switch','off'),
	('auto_purchase','on'),
	('growth_mode','on'),
	('max_daily_spend_usd','100'),
	('price_markup_usd','0.001');

-- Seed one compliant example: NewsAPI
INSERT OR IGNORE INTO services (id,name,base_url,rps_limit,daily_quota,vendor,vendor_plan)
VALUES (1,'newsapi', 'https://newsapi.org/v2/', 5, 500, 'NewsAPI','pro');
