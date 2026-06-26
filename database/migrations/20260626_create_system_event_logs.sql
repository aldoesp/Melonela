CREATE TABLE IF NOT EXISTS system_event_logs (
    id SERIAL PRIMARY KEY,
    source_name VARCHAR(120) NOT NULL,
    source_type VARCHAR(80) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
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
CREATE INDEX IF NOT EXISTS idx_system_event_logs_received_at ON system_event_logs(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_event_logs_event_timestamp ON system_event_logs(event_timestamp DESC);
