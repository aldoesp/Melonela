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
    eventType: row.event_type,
    severity: row.severity,
    message: row.message,
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
      event_type VARCHAR(100) NOT NULL,
      severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
      message TEXT NOT NULL,
      raw_payload JSONB DEFAULT '{}'::jsonb,
      normalized_payload JSONB DEFAULT '{}'::jsonb,
      event_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
      received_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query('CREATE INDEX IF NOT EXISTS idx_system_event_logs_severity ON system_event_logs(severity)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_system_event_logs_event_type ON system_event_logs(event_type)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_system_event_logs_source_type ON system_event_logs(source_type)');
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
      (source_name, source_type, event_type, severity, message, raw_payload, normalized_payload, event_timestamp)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, source_name, source_type, event_type, severity, message, raw_payload, normalized_payload,
       event_timestamp, received_at, created_at`,
    [
      log.source_name,
      log.source_type,
      log.event_type,
      log.severity,
      log.message,
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
    `SELECT id, source_name, source_type, event_type, severity, message, raw_payload, normalized_payload,
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
