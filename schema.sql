-- Sina Empire Crypto Payment Database Schema
-- D1 Database: sina-empire-cashflow

-- Crypto payments table
CREATE TABLE IF NOT EXISTS crypto_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  payment_id TEXT UNIQUE NOT NULL,
  amount_usd REAL NOT NULL,
  crypto_type TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  service_type TEXT NOT NULL,
  customer_id TEXT,
  status TEXT DEFAULT 'pending',
  tx_hash TEXT,
  created_at TEXT NOT NULL,
  confirmed_at TEXT,
  expires_at TEXT
);

-- Revenue streams table
CREATE TABLE IF NOT EXISTS revenue_streams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stream_name TEXT NOT NULL,
  crypto_type TEXT NOT NULL,
  amount_crypto REAL NOT NULL,
  amount_usd REAL NOT NULL,
  transaction_date TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  service_provided TEXT,
  customer_id TEXT
);

-- Wallet balances table
CREATE TABLE IF NOT EXISTS wallet_balances (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  crypto_type TEXT UNIQUE NOT NULL,
  balance_crypto REAL NOT NULL,
  balance_usd REAL NOT NULL,
  wallet_address TEXT NOT NULL,
  last_updated TEXT NOT NULL
);

-- Transactions log table
CREATE TABLE IF NOT EXISTS transactions_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tx_hash TEXT UNIQUE NOT NULL,
  crypto_type TEXT NOT NULL,
  amount_crypto REAL NOT NULL,
  amount_usd REAL NOT NULL,
  from_address TEXT,
  to_address TEXT NOT NULL,
  confirmations INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending',
  timestamp TEXT NOT NULL,
  block_height INTEGER
);

-- Customers table
CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id TEXT UNIQUE NOT NULL,
  email TEXT,
  service_level TEXT DEFAULT 'basic',
  total_paid_usd REAL DEFAULT 0,
  preferred_crypto TEXT,
  created_at TEXT NOT NULL,
  last_payment TEXT
);

-- Insert initial wallet balances
INSERT OR REPLACE INTO wallet_balances (crypto_type, balance_crypto, balance_usd, wallet_address, last_updated) VALUES
('btc', 0.00482547, 285.42, 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh', datetime('now')),
('eth', 0.8247, 2847.12, '0x742d35cc6634c0532925a3b8d9ad65c12352b23f', datetime('now')),
('xmr', 2.847, 542.18, '49AXJLBdmGQLt7B4a8FdJqRBr5X7J6QC34QRFLDdZkhcM8RTvqmLvd', datetime('now')),
('usdt', 847.23, 847.23, '0x742d35cc6634c0532925a3b8d9ad65c12352b23f', datetime('now'));

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_payments_status ON crypto_payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_crypto_type ON crypto_payments(crypto_type);
CREATE INDEX IF NOT EXISTS idx_transactions_tx_hash ON transactions_log(tx_hash);
CREATE INDEX IF NOT EXISTS idx_customers_customer_id ON customers(customer_id);