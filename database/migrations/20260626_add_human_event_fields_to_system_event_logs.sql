ALTER TABLE system_event_logs ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE system_event_logs ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE system_event_logs ADD COLUMN IF NOT EXISTS category VARCHAR(100);
ALTER TABLE system_event_logs ADD COLUMN IF NOT EXISTS icon VARCHAR(100);
ALTER TABLE system_event_logs ADD COLUMN IF NOT EXISTS human_severity VARCHAR(30);
ALTER TABLE system_event_logs ADD COLUMN IF NOT EXISTS interpretation_rule_id VARCHAR(150);
ALTER TABLE system_event_logs ADD COLUMN IF NOT EXISTS interpretation_confidence NUMERIC(4,2);

CREATE INDEX IF NOT EXISTS idx_system_event_logs_category ON system_event_logs(category);
CREATE INDEX IF NOT EXISTS idx_system_event_logs_human_severity ON system_event_logs(human_severity);
CREATE INDEX IF NOT EXISTS idx_system_event_logs_interpretation_rule_id ON system_event_logs(interpretation_rule_id);
