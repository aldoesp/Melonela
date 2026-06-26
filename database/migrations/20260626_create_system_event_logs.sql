CREATE TABLE IF NOT EXISTS system_event_logs (
    id SERIAL PRIMARY KEY,
    source_name VARCHAR(120) NOT NULL,
    source_type VARCHAR(80) NOT NULL,
    service VARCHAR(100),
    process_name VARCHAR(100),
    process_id VARCHAR(50),
    host_name VARCHAR(100),
    event_type VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    username VARCHAR(100),
    tty VARCHAR(100),
    working_directory TEXT,
    target_user VARCHAR(100),
    command TEXT,
    message TEXT NOT NULL,
    raw_payload JSONB DEFAULT '{}'::jsonb,
    normalized_payload JSONB DEFAULT '{}'::jsonb,
    event_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    received_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_system_event_logs_severity ON system_event_logs(severity);
CREATE INDEX IF NOT EXISTS idx_system_event_logs_event_type ON system_event_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_system_event_logs_source_type ON system_event_logs(source_type);
CREATE INDEX IF NOT EXISTS idx_system_event_logs_service ON system_event_logs(service);
CREATE INDEX IF NOT EXISTS idx_system_event_logs_username ON system_event_logs(username);
CREATE INDEX IF NOT EXISTS idx_system_event_logs_command ON system_event_logs(command);
CREATE INDEX IF NOT EXISTS idx_system_event_logs_working_directory ON system_event_logs(working_directory);
CREATE INDEX IF NOT EXISTS idx_system_event_logs_received_at ON system_event_logs(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_event_logs_event_timestamp ON system_event_logs(event_timestamp DESC);
