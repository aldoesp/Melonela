ALTER TABLE system_event_logs ADD COLUMN IF NOT EXISTS service VARCHAR(100);
ALTER TABLE system_event_logs ADD COLUMN IF NOT EXISTS process_name VARCHAR(100);
ALTER TABLE system_event_logs ADD COLUMN IF NOT EXISTS process_id VARCHAR(50);
ALTER TABLE system_event_logs ADD COLUMN IF NOT EXISTS host_name VARCHAR(100);
ALTER TABLE system_event_logs ADD COLUMN IF NOT EXISTS username VARCHAR(100);
ALTER TABLE system_event_logs ADD COLUMN IF NOT EXISTS tty VARCHAR(100);
ALTER TABLE system_event_logs ADD COLUMN IF NOT EXISTS working_directory TEXT;
ALTER TABLE system_event_logs ADD COLUMN IF NOT EXISTS target_user VARCHAR(100);
ALTER TABLE system_event_logs ADD COLUMN IF NOT EXISTS command TEXT;

CREATE INDEX IF NOT EXISTS idx_system_event_logs_service ON system_event_logs(service);
CREATE INDEX IF NOT EXISTS idx_system_event_logs_username ON system_event_logs(username);
CREATE INDEX IF NOT EXISTS idx_system_event_logs_command ON system_event_logs(command);
CREATE INDEX IF NOT EXISTS idx_system_event_logs_working_directory ON system_event_logs(working_directory);
CREATE INDEX IF NOT EXISTS idx_system_event_logs_event_type ON system_event_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_system_event_logs_severity ON system_event_logs(severity);
CREATE INDEX IF NOT EXISTS idx_system_event_logs_received_at ON system_event_logs(received_at DESC);
