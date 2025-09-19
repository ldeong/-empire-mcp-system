-- Insert initial data for SINA Empire Crypto Gateway

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