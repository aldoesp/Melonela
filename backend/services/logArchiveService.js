const crypto = require('crypto');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { spawn } = require('child_process');
const pool = require('../config/db');
const { readCompressedJsonlLogs, toPositiveInt } = require('./compressedLogReader');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const DEFAULT_ARCHIVE_AFTER_DAYS = 30;
const DEFAULT_BATCH_LIMIT = 5000;
const LOG_ARCHIVE_COLUMNS = `
  id, host_name, year, month, week, day, process_name, source_type, date_start, date_end,
  file_path, compression, log_count, size_bytes, checksum, archive_status, created_at
`;

function getArchiveRoot() {
  const configured = process.env.MELONELA_LOG_ARCHIVE_DIR || './melonela_logs';
  return path.isAbsolute(configured)
    ? configured
    : path.resolve(PROJECT_ROOT, configured);
}

function sanitizePathSegment(value, fallback = 'unknown') {
  const segment = String(value || fallback)
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '_')
    .replace(/^_+|_+$/g, '');

  return segment || fallback;
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

function getIsoWeek(dateInput) {
  const date = new Date(dateInput);
  const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  return Math.ceil((((utc - yearStart) / 86400000) + 1) / 7);
}

function getDateParts(dateInput) {
  const date = new Date(dateInput);
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    week: getIsoWeek(date),
    day: date.getUTCDate(),
  };
}

function buildArchivePath({ hostName, year, month, week, day, processName, archiveRoot = getArchiveRoot() }) {
  return path.join(
    archiveRoot,
    'hosts',
    sanitizePathSegment(hostName || 'localhost'),
    `year=${year}`,
    `month=${pad2(month)}`,
    `week=${pad2(week)}`,
    `day=${pad2(day)}`,
    `${sanitizePathSegment(processName)}.jsonl.zst`
  );
}

async function resolveArchiveOutputPath(basePath) {
  try {
    await fsp.access(basePath);
  } catch (_) {
    return basePath;
  }

  const timestamp = new Date().toISOString().replace(/[^\d]/g, '').slice(0, 14);

  for (let index = 1; index <= 100; index += 1) {
    const candidate = basePath.replace(/\.jsonl\.zst$/, `-${timestamp}-${index}.jsonl.zst`);
    try {
      await fsp.access(candidate);
    } catch (_) {
      return candidate;
    }
  }

  throw new Error(`Impossible de créer un nom d'archive disponible pour ${basePath}`);
}

function serializeLogForArchive(log) {
  return {
    id: log.id,
    source_name: log.source_name,
    source_type: log.source_type,
    service: log.service,
    process_name: log.process_name,
    process_id: log.process_id,
    host_name: log.host_name,
    event_type: log.event_type,
    severity: log.severity,
    username: log.username,
    tty: log.tty,
    working_directory: log.working_directory,
    target_user: log.target_user,
    command: log.command,
    message: log.message,
    title: log.title,
    description: log.description,
    category: log.category,
    icon: log.icon,
    human_severity: log.human_severity,
    interpretation_rule_id: log.interpretation_rule_id,
    interpretation_confidence: log.interpretation_confidence,
    raw_payload: log.raw_payload || {},
    normalized_payload: log.normalized_payload || {},
    event_timestamp: log.event_timestamp,
    received_at: log.received_at,
    created_at: log.created_at,
  };
}

async function writeLine(stream, line) {
  if (stream.write(line)) return;
  await new Promise((resolve) => stream.once('drain', resolve));
}

async function exportLogsToJsonl(logs, outputPath) {
  await fsp.mkdir(path.dirname(outputPath), { recursive: true });

  const stream = fs.createWriteStream(outputPath, { encoding: 'utf8' });
  const finished = new Promise((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
  });

  try {
    for (const log of logs) {
      await writeLine(stream, `${JSON.stringify(serializeLogForArchive(log))}\n`);
    }
  } finally {
    stream.end();
  }

  await finished;

  return outputPath;
}

function runZstd(args, errorMessage) {
  return new Promise((resolve, reject) => {
    const child = spawn('zstd', args, {
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    const stderrChunks = [];

    child.stderr.on('data', (chunk) => {
      stderrChunks.push(chunk.toString());
    });

    child.on('error', (error) => {
      if (error.code === 'ENOENT') {
        reject(new Error(errorMessage));
        return;
      }

      reject(error);
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(stderrChunks.join('').trim() || `zstd failed with exit code ${code}`));
    });
  });
}

async function compressWithZstd(inputPath, outputPath) {
  await fsp.mkdir(path.dirname(outputPath), { recursive: true });
  await runZstd(['-f', '-q', '-o', outputPath, inputPath], 'zstd is required to create compressed log archives. Please install it.');
  return outputPath;
}

async function calculateSha256(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);

    stream.on('error', reject);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

async function ensureLogArchiveTable(db = pool) {
  await db.query(`
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
    )
  `);

  await db.query(`CREATE INDEX IF NOT EXISTS idx_log_archives_lookup
    ON log_archives(host_name, process_name, year, month, day)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_log_archives_date_range
    ON log_archives(date_start, date_end)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_log_archives_status
    ON log_archives(archive_status)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_log_archives_host_process_date
    ON log_archives(host_name, process_name, date_start, date_end)`);
}

async function createArchiveIndex(metadata, db = pool) {
  const result = await db.query(
    `INSERT INTO log_archives
      (host_name, year, month, week, day, process_name, source_type, date_start, date_end,
       file_path, compression, log_count, size_bytes, checksum, archive_status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
     RETURNING ${LOG_ARCHIVE_COLUMNS}`,
    [
      metadata.hostName,
      metadata.year,
      metadata.month,
      metadata.week,
      metadata.day,
      metadata.processName,
      metadata.sourceType || null,
      metadata.dateStart,
      metadata.dateEnd,
      metadata.filePath,
      metadata.compression || 'zstd',
      metadata.logCount || 0,
      metadata.sizeBytes || 0,
      metadata.checksum,
      metadata.archiveStatus || 'available',
    ]
  );

  return result.rows[0];
}

async function deleteArchivedRows(criteria, db = pool) {
  if (!criteria?.ids?.length) {
    return { deletedCount: 0 };
  }

  const result = await db.query(
    'DELETE FROM system_event_logs WHERE id = ANY($1::int[])',
    [criteria.ids]
  );

  return { deletedCount: result.rowCount };
}

function groupLogs(logs) {
  const groups = new Map();

  for (const log of logs) {
    const timestamp = log.event_timestamp || log.created_at;
    const parts = getDateParts(timestamp);
    const hostName = log.host_name || log.normalized_payload?.hostname || 'localhost';
    const processName = log.process_name || log.service || 'unknown';
    const key = [
      hostName,
      parts.year,
      parts.month,
      parts.week,
      parts.day,
      processName,
    ].join('|');

    if (!groups.has(key)) {
      groups.set(key, {
        hostName,
        processName,
        sourceType: log.source_type || null,
        ...parts,
        logs: [],
      });
    }

    groups.get(key).logs.push(log);
  }

  return Array.from(groups.values());
}

async function archiveGroup(group, db = pool) {
  const outputPath = await resolveArchiveOutputPath(buildArchivePath(group));
  const jsonlPath = outputPath.replace(/\.zst$/, '');
  const timestamps = group.logs.map((log) => new Date(log.event_timestamp).getTime()).filter(Number.isFinite);
  const fallbackTimestamp = Date.now();
  const dateStart = new Date(timestamps.length ? Math.min(...timestamps) : fallbackTimestamp).toISOString();
  const dateEnd = new Date(timestamps.length ? Math.max(...timestamps) : fallbackTimestamp).toISOString();

  await exportLogsToJsonl(group.logs, jsonlPath);
  await compressWithZstd(jsonlPath, outputPath);

  const stat = await fsp.stat(outputPath);
  const checksum = await calculateSha256(outputPath);

  if (!stat.size || !checksum) {
    throw new Error(`Archive invalide: ${outputPath}`);
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const archive = await createArchiveIndex({
      hostName: group.hostName,
      year: group.year,
      month: group.month,
      week: group.week,
      day: group.day,
      processName: group.processName,
      sourceType: group.sourceType,
      dateStart,
      dateEnd,
      filePath: outputPath,
      compression: 'zstd',
      logCount: group.logs.length,
      sizeBytes: stat.size,
      checksum,
      archiveStatus: 'available',
    }, client);

    const deleted = await deleteArchivedRows({
      ids: group.logs.map((log) => log.id),
    }, client);
    await client.query('COMMIT');

    await fsp.unlink(jsonlPath).catch(() => {});

    return {
      archive,
      deletedCount: deleted.deletedCount,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function archiveOldSystemLogs(options = {}) {
  const archiveAfterDays = toPositiveInt(
    options.archiveAfterDays ?? process.env.LOG_ARCHIVE_AFTER_DAYS,
    DEFAULT_ARCHIVE_AFTER_DAYS,
    3650
  );
  const batchLimit = toPositiveInt(options.batchLimit, DEFAULT_BATCH_LIMIT, 50000);
  const cutoff = options.cutoffDate
    ? new Date(options.cutoffDate)
    : new Date(Date.now() - archiveAfterDays * 86400000);

  await ensureLogArchiveTable();

  const result = await pool.query(
    `SELECT id, source_name, source_type, service, process_name, process_id, host_name, event_type, severity,
       username, tty, working_directory, target_user, command, message, title, description, category, icon,
       human_severity, interpretation_rule_id, interpretation_confidence, raw_payload, normalized_payload,
       event_timestamp, received_at, created_at
     FROM system_event_logs
     WHERE event_timestamp < $1
     ORDER BY event_timestamp ASC, id ASC
     LIMIT $2`,
    [cutoff.toISOString(), batchLimit]
  );

  const groups = groupLogs(result.rows);
  const archived = [];

  for (const group of groups) {
    archived.push(await archiveGroup(group));
  }

  return {
    cutoff: cutoff.toISOString(),
    selectedCount: result.rows.length,
    archiveCount: archived.length,
    deletedCount: archived.reduce((total, item) => total + item.deletedCount, 0),
    archives: archived.map((item) => item.archive),
  };
}

function buildLogArchiveIndexQuery(query = {}) {
  const conditions = [];
  const values = [];

  ['host_name', 'process_name', 'archive_status'].forEach((field) => {
    if (query[field]) {
      values.push(query[field]);
      conditions.push(`${field} = $${values.length}`);
    }
  });

  ['year', 'month', 'day'].forEach((field) => {
    if (query[field]) {
      values.push(Number.parseInt(query[field], 10));
      conditions.push(`${field} = $${values.length}`);
    }
  });

  return {
    clause: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '',
    values,
  };
}

async function listArchiveIndex(query = {}, db = pool) {
  const limit = toPositiveInt(query.limit, 100, 500);
  const { clause, values } = buildLogArchiveIndexQuery(query);

  const result = await db.query(
    `SELECT ${LOG_ARCHIVE_COLUMNS}
     FROM log_archives
     ${clause}
     ORDER BY date_start DESC, id DESC
     LIMIT $${values.length + 1}`,
    [...values, limit]
  );

  return result.rows;
}

function buildArchiveLookupQuery(query = {}) {
  const date = query.date ? new Date(`${query.date}T00:00:00.000Z`) : null;
  const conditions = ['archive_status = $1'];
  const values = [query.archive_status || 'available'];

  if (query.host_name) {
    values.push(query.host_name);
    conditions.push(`host_name = $${values.length}`);
  }

  if (query.process_name) {
    values.push(query.process_name);
    conditions.push(`process_name = $${values.length}`);
  }

  if (date && !Number.isNaN(date.getTime())) {
    const nextDay = new Date(date.getTime() + 86400000);
    values.push(nextDay.toISOString());
    conditions.push(`date_start < $${values.length}`);
    values.push(date.toISOString());
    conditions.push(`date_end >= $${values.length}`);
  }

  return {
    clause: `WHERE ${conditions.join(' AND ')}`,
    values,
  };
}

async function findArchivesForLogsQuery(query = {}, db = pool) {
  const { clause, values } = buildArchiveLookupQuery(query);
  const result = await db.query(
    `SELECT ${LOG_ARCHIVE_COLUMNS}
     FROM log_archives
     ${clause}
     ORDER BY date_start DESC, id DESC
     LIMIT 10`,
    values
  );

  return result.rows;
}

async function findArchivedLogs(query = {}, db = pool) {
  const archives = await findArchivesForLogsQuery(query, db);
  if (!archives.length) {
    return {
      status: 'not_found',
      message: 'Aucune archive trouvée pour cette date, ce host et ce process.',
      logs: [],
    };
  }

  const limit = toPositiveInt(query.limit);
  const archive = archives[0];
  const logs = await readCompressedJsonlLogs(archive.file_path, {
    severity: query.severity,
    event_type: query.event_type,
    category: query.category,
    search: query.search,
    limit,
  });

  return {
    status: 'success',
    source: 'archive',
    archive: {
      host_name: archive.host_name,
      process_name: archive.process_name,
      compression: archive.compression,
      file_path: archive.file_path,
      log_count: archive.log_count,
    },
    logs,
  };
}

module.exports = {
  archiveOldSystemLogs,
  buildArchiveLookupQuery,
  buildArchivePath,
  buildLogArchiveIndexQuery,
  calculateSha256,
  compressWithZstd,
  createArchiveIndex,
  deleteArchivedRows,
  ensureLogArchiveTable,
  exportLogsToJsonl,
  findArchivedLogs,
  findArchivesForLogsQuery,
  getArchiveRoot,
  getDateParts,
  getIsoWeek,
  groupLogs,
  listArchiveIndex,
  resolveArchiveOutputPath,
  sanitizePathSegment,
  serializeLogForArchive,
};
