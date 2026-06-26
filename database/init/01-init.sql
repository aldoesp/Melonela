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
