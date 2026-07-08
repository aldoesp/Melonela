const fs = require('fs/promises');
const { spawn } = require('child_process');
const readline = require('readline');

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 1000;
const ZSTD_REQUIRED_MESSAGE = 'zstd is required to read compressed log archives. Please install it.';

function toPositiveInt(value, fallback = DEFAULT_LIMIT, max = MAX_LIMIT) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

function normalizeText(value) {
  return String(value ?? '').toLowerCase();
}

function getLogValue(log, snakeKey, camelKey = snakeKey) {
  if (log[snakeKey] !== undefined) return log[snakeKey];
  return log[camelKey];
}

function matchesFilters(log, filters = {}) {
  if (filters.severity && getLogValue(log, 'severity') !== filters.severity) return false;
  if (filters.event_type && getLogValue(log, 'event_type', 'eventType') !== filters.event_type) return false;
  if (filters.category && getLogValue(log, 'category') !== filters.category) return false;

  const search = typeof filters.search === 'string' ? filters.search.trim() : '';
  if (search) {
    const haystack = [
      getLogValue(log, 'message'),
      getLogValue(log, 'title'),
      getLogValue(log, 'description'),
      getLogValue(log, 'command'),
      getLogValue(log, 'username'),
      getLogValue(log, 'service'),
      JSON.stringify(getLogValue(log, 'normalized_payload', 'normalizedPayload') || {}),
    ].join(' ');

    if (!normalizeText(haystack).includes(normalizeText(search))) return false;
  }

  return true;
}

async function readCompressedJsonlLogs(filePath, filters = {}) {
  await fs.access(filePath);

  const limit = toPositiveInt(filters.limit);
  const stderrChunks = [];
  const results = [];

  return new Promise((resolve, reject) => {
    let stoppedAfterLimit = false;
    let settled = false;

    const child = spawn('zstd', ['-dc', filePath], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      if (error) reject(error);
      else resolve(value);
    };

    child.on('error', (error) => {
      if (error.code === 'ENOENT') {
        finish(new Error(ZSTD_REQUIRED_MESSAGE));
        return;
      }

      finish(error);
    });

    child.stderr.on('data', (chunk) => {
      stderrChunks.push(chunk.toString());
    });

    const reader = readline.createInterface({
      input: child.stdout,
      crlfDelay: Infinity,
    });

    reader.on('line', (line) => {
      if (!line.trim()) return;

      try {
        const log = JSON.parse(line);
        if (matchesFilters(log, filters)) {
          results.push(log);
        }
      } catch (_) {
        return;
      }

      if (results.length >= limit) {
        stoppedAfterLimit = true;
        reader.close();
        child.kill('SIGTERM');
      }
    });

    child.on('close', (code, signal) => {
      if (stoppedAfterLimit && signal === 'SIGTERM') {
        finish(null, results);
        return;
      }

      if (code && code !== 0) {
        const stderr = stderrChunks.join('').trim();
        finish(new Error(stderr || `zstd failed with exit code ${code}`));
        return;
      }

      finish(null, results);
    });
  });
}

module.exports = {
  DEFAULT_LIMIT,
  ZSTD_REQUIRED_MESSAGE,
  matchesFilters,
  readCompressedJsonlLogs,
  toPositiveInt,
};
