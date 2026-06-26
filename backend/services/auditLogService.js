const pool = require('../config/db');
const { emitSystemEventCreated } = require('../realtime/socket');

function toPositiveInt(value, fallback, max) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

function mapSystemEventLog(row) {
  return {
    id: row.id,
    sourceName: row.source_name,
    sourceType: row.source_type,
    service: row.service,
    processName: row.process_name,
    processId: row.process_id,
    hostName: row.host_name,
    eventType: row.event_type,
    severity: row.severity,
    username: row.username,
    tty: row.tty,
    workingDirectory: row.working_directory,
    targetUser: row.target_user,
    command: row.command,
    message: row.message,
    title: row.title,
    description: row.description,
    category: row.category,
    icon: row.icon,
    humanSeverity: row.human_severity,
    interpretationRuleId: row.interpretation_rule_id,
    interpretationConfidence: row.interpretation_confidence !== null && row.interpretation_confidence !== undefined
      ? Number(row.interpretation_confidence)
      : null,
    rawPayload: row.raw_payload || {},
    normalizedPayload: row.normalized_payload || {},
    eventTimestamp: row.event_timestamp,
    receivedAt: row.received_at,
    createdAt: row.created_at,
  };
}

async function ensureSystemEventLogTable() {
  await pool.query(`
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
    )
  `);

  await pool.query('ALTER TABLE system_event_logs ADD COLUMN IF NOT EXISTS service VARCHAR(100)');
  await pool.query('ALTER TABLE system_event_logs ADD COLUMN IF NOT EXISTS process_name VARCHAR(100)');
  await pool.query('ALTER TABLE system_event_logs ADD COLUMN IF NOT EXISTS process_id VARCHAR(50)');
  await pool.query('ALTER TABLE system_event_logs ADD COLUMN IF NOT EXISTS host_name VARCHAR(100)');
  await pool.query('ALTER TABLE system_event_logs ADD COLUMN IF NOT EXISTS username VARCHAR(100)');
  await pool.query('ALTER TABLE system_event_logs ADD COLUMN IF NOT EXISTS tty VARCHAR(100)');
  await pool.query('ALTER TABLE system_event_logs ADD COLUMN IF NOT EXISTS working_directory TEXT');
  await pool.query('ALTER TABLE system_event_logs ADD COLUMN IF NOT EXISTS target_user VARCHAR(100)');
  await pool.query('ALTER TABLE system_event_logs ADD COLUMN IF NOT EXISTS command TEXT');
  await pool.query('ALTER TABLE system_event_logs ADD COLUMN IF NOT EXISTS title TEXT');
  await pool.query('ALTER TABLE system_event_logs ADD COLUMN IF NOT EXISTS description TEXT');
  await pool.query('ALTER TABLE system_event_logs ADD COLUMN IF NOT EXISTS category VARCHAR(100)');
  await pool.query('ALTER TABLE system_event_logs ADD COLUMN IF NOT EXISTS icon VARCHAR(100)');
  await pool.query('ALTER TABLE system_event_logs ADD COLUMN IF NOT EXISTS human_severity VARCHAR(30)');
  await pool.query('ALTER TABLE system_event_logs ADD COLUMN IF NOT EXISTS interpretation_rule_id VARCHAR(150)');
  await pool.query('ALTER TABLE system_event_logs ADD COLUMN IF NOT EXISTS interpretation_confidence NUMERIC(4,2)');

  await pool.query('CREATE INDEX IF NOT EXISTS idx_system_event_logs_severity ON system_event_logs(severity)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_system_event_logs_event_type ON system_event_logs(event_type)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_system_event_logs_source_type ON system_event_logs(source_type)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_system_event_logs_service ON system_event_logs(service)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_system_event_logs_username ON system_event_logs(username)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_system_event_logs_command ON system_event_logs(command)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_system_event_logs_working_directory ON system_event_logs(working_directory)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_system_event_logs_category ON system_event_logs(category)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_system_event_logs_human_severity ON system_event_logs(human_severity)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_system_event_logs_interpretation_rule_id ON system_event_logs(interpretation_rule_id)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_system_event_logs_received_at ON system_event_logs(received_at DESC)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_system_event_logs_event_timestamp ON system_event_logs(event_timestamp DESC)');
}

function buildWhereClause(filters) {
  const conditions = [];
  const values = [];

  if (filters.search) {
    values.push(`%${filters.search}%`);
    const index = values.length;
    conditions.push(`(
      source_name ILIKE $${index}
      OR source_type ILIKE $${index}
      OR event_type ILIKE $${index}
      OR severity ILIKE $${index}
      OR COALESCE(service, '') ILIKE $${index}
      OR COALESCE(username, '') ILIKE $${index}
      OR COALESCE(command, '') ILIKE $${index}
      OR COALESCE(working_directory, '') ILIKE $${index}
      OR COALESCE(title, '') ILIKE $${index}
      OR COALESCE(description, '') ILIKE $${index}
      OR message ILIKE $${index}
      OR raw_payload::text ILIKE $${index}
      OR normalized_payload::text ILIKE $${index}
    )`);
  }

  if (filters.severity) {
    values.push(filters.severity);
    conditions.push(`severity = $${values.length}`);
  }

  if (filters.eventType) {
    values.push(filters.eventType);
    conditions.push(`event_type = $${values.length}`);
  }

  if (filters.sourceType) {
    values.push(filters.sourceType);
    conditions.push(`source_type = $${values.length}`);
  }

  if (filters.service) {
    values.push(filters.service);
    conditions.push(`service = $${values.length}`);
  }

  if (filters.username) {
    values.push(filters.username);
    conditions.push(`username = $${values.length}`);
  }

  if (filters.command) {
    values.push(`%${filters.command}%`);
    conditions.push(`command ILIKE $${values.length}`);
  }

  if (filters.workingDirectory) {
    values.push(`%${filters.workingDirectory}%`);
    conditions.push(`working_directory ILIKE $${values.length}`);
  }

  if (filters.category) {
    values.push(filters.category);
    conditions.push(`category = $${values.length}`);
  }

  if (filters.humanSeverity) {
    values.push(filters.humanSeverity);
    conditions.push(`human_severity = $${values.length}`);
  }

  if (filters.interpretationRuleId) {
    values.push(filters.interpretationRuleId);
    conditions.push(`interpretation_rule_id = $${values.length}`);
  }

  if (filters.dateFrom) {
    values.push(filters.dateFrom);
    conditions.push(`event_timestamp >= $${values.length}`);
  }

  if (filters.dateTo) {
    values.push(filters.dateTo);
    conditions.push(`event_timestamp <= $${values.length}`);
  }

  return {
    clause: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '',
    values,
  };
}

async function insertSystemEventLog(log) {
  const result = await pool.query(
    `INSERT INTO system_event_logs
      (source_name, source_type, service, process_name, process_id, host_name, event_type, severity,
       username, tty, working_directory, target_user, command, message, title, description, category, icon,
       human_severity, interpretation_rule_id, interpretation_confidence, raw_payload, normalized_payload, event_timestamp)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
       $17, $18, $19, $20, $21, $22, $23, $24)
     RETURNING id, source_name, source_type, service, process_name, process_id, host_name, event_type, severity,
       username, tty, working_directory, target_user, command, message, title, description, category, icon,
       human_severity, interpretation_rule_id, interpretation_confidence, raw_payload, normalized_payload,
       event_timestamp, received_at, created_at`,
    [
      log.source_name,
      log.source_type,
      log.service || null,
      log.process_name || null,
      log.process_id || null,
      log.host_name || null,
      log.event_type,
      log.severity,
      log.username || null,
      log.tty || null,
      log.working_directory || null,
      log.target_user || null,
      log.command || null,
      log.message,
      log.title || null,
      log.description || null,
      log.category || null,
      log.icon || null,
      log.human_severity || null,
      log.interpretation_rule_id || null,
      log.interpretation_confidence ?? null,
      log.raw_payload || {},
      log.normalized_payload || {},
      log.event_timestamp,
    ]
  );

  const created = mapSystemEventLog(result.rows[0]);
  emitSystemEventCreated(created);
  return created;
}

async function listAuditLogs(query = {}) {
  const page = toPositiveInt(query.page, 1, 100000);
  const limit = toPositiveInt(query.limit, 20, 100);
  const offset = (page - 1) * limit;

  const filters = {
    search: typeof query.search === 'string' ? query.search.trim() : '',
    severity: typeof query.severity === 'string' ? query.severity.trim() : '',
    eventType: typeof query.event_type === 'string' ? query.event_type.trim() : (query.eventType || ''),
    sourceType: typeof query.source_type === 'string' ? query.source_type.trim() : (query.sourceType || ''),
    service: typeof query.service === 'string' ? query.service.trim() : '',
    username: typeof query.username === 'string' ? query.username.trim() : '',
    command: typeof query.command === 'string' ? query.command.trim() : '',
    workingDirectory: typeof query.working_directory === 'string' ? query.working_directory.trim() : (query.workingDirectory || ''),
    category: typeof query.category === 'string' ? query.category.trim() : '',
    humanSeverity: typeof query.human_severity === 'string' ? query.human_severity.trim() : (query.humanSeverity || ''),
    interpretationRuleId: typeof query.interpretation_rule_id === 'string' ? query.interpretation_rule_id.trim() : (query.interpretationRuleId || ''),
    dateFrom: query.date_from || query.dateFrom || query.startDate || '',
    dateTo: query.date_to || query.dateTo || query.endDate || '',
  };

  const { clause, values } = buildWhereClause(filters);

  const countResult = await pool.query(
    `SELECT COUNT(*)::int AS total FROM system_event_logs ${clause}`,
    values
  );

  const total = countResult.rows[0]?.total || 0;
  const totalPages = Math.max(Math.ceil(total / limit), 1);

  const dataResult = await pool.query(
    `SELECT id, source_name, source_type, service, process_name, process_id, host_name, event_type, severity,
       username, tty, working_directory, target_user, command, message, title, description, category, icon,
       human_severity, interpretation_rule_id, interpretation_confidence, raw_payload, normalized_payload,
       event_timestamp, received_at, created_at
     FROM system_event_logs
     ${clause}
     ORDER BY event_timestamp DESC, received_at DESC, id DESC
     LIMIT $${values.length + 1}
     OFFSET $${values.length + 2}`,
    [...values, limit, offset]
  );

  return {
    data: dataResult.rows.map(mapSystemEventLog),
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
  };
}

module.exports = {
  ensureSystemEventLogTable,
  insertSystemEventLog,
  listAuditLogs,
  mapSystemEventLog,
  buildWhereClause,
};
