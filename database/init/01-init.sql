-- Création de la base de données (au cas où, mais gérée par Docker)
-- Création de la table des utilisateurs (Administrateurs / Auditeurs du SIEM)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(80),
    last_name VARCHAR(80),
    email VARCHAR(160) UNIQUE,
    role VARCHAR(50) DEFAULT 'user', -- 'user', 'auditor', 'admin', 'super_admin'
    is_active BOOLEAN DEFAULT TRUE,
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index pour accélérer la phase d'authentification (recherche par username ou email)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    service_name VARCHAR(50) NOT NULL,
    ip_source VARCHAR(45) NOT NULL,
    action_type VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL, -- 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
    message TEXT NOT NULL
);

-- Index pour accélérer les requêtes de recherche de ton Backend Node.js
CREATE INDEX IF NOT EXISTS idx_audit_logs_severity ON audit_logs(severity);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);

CREATE TABLE IF NOT EXISTS user_action_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    username VARCHAR(50) NOT NULL,
    action_type VARCHAR(100) NOT NULL,
    resource VARCHAR(120),
    status VARCHAR(20) NOT NULL DEFAULT 'SUCCESS',
    ip_source VARCHAR(45),
    user_agent TEXT,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_action_logs_user_id ON user_action_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_action_logs_created_at ON user_action_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_action_logs_action_type ON user_action_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_user_action_logs_resource ON user_action_logs(resource);
CREATE INDEX IF NOT EXISTS idx_user_action_logs_status ON user_action_logs(status);

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
    title TEXT,
    description TEXT,
    category VARCHAR(100),
    icon VARCHAR(100),
    human_severity VARCHAR(30),
    interpretation_rule_id VARCHAR(150),
    interpretation_confidence NUMERIC(4,2),
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
CREATE INDEX IF NOT EXISTS idx_system_event_logs_category ON system_event_logs(category);
CREATE INDEX IF NOT EXISTS idx_system_event_logs_human_severity ON system_event_logs(human_severity);
CREATE INDEX IF NOT EXISTS idx_system_event_logs_interpretation_rule_id ON system_event_logs(interpretation_rule_id);
CREATE INDEX IF NOT EXISTS idx_system_event_logs_received_at ON system_event_logs(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_event_logs_event_timestamp ON system_event_logs(event_timestamp DESC);

CREATE TABLE IF NOT EXISTS log_archives (
    id SERIAL PRIMARY KEY,

    host_name VARCHAR(100) NOT NULL,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    week INTEGER NOT NULL,
    day INTEGER NOT NULL,

    process_name VARCHAR(100) NOT NULL,
    source_type VARCHAR(80),

    date_start TIMESTAMP WITH TIME ZONE NOT NULL,
    date_end TIMESTAMP WITH TIME ZONE NOT NULL,

    file_path TEXT NOT NULL,
    compression VARCHAR(20) NOT NULL DEFAULT 'zstd',

    log_count INTEGER DEFAULT 0,
    size_bytes BIGINT DEFAULT 0,
    checksum VARCHAR(128),

    archive_status VARCHAR(30) NOT NULL DEFAULT 'available',

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_log_archives_lookup
ON log_archives(host_name, process_name, year, month, day);

CREATE INDEX IF NOT EXISTS idx_log_archives_date_range
ON log_archives(date_start, date_end);

CREATE INDEX IF NOT EXISTS idx_log_archives_status
ON log_archives(archive_status);

CREATE INDEX IF NOT EXISTS idx_log_archives_host_process_date
ON log_archives(host_name, process_name, date_start, date_end);
