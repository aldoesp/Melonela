const path = require('path');

function getDefaultArchiveBaseDir() {
  return process.env.MELONELA_LOG_ARCHIVE_DIR || './melonela_logs';
}

function sanitizePathPart(value) {
  const cleaned = String(value ?? 'unknown')
    .trim()
    // Les séparateurs et caractères hors liste deviennent des underscores.
    .replace(/[\/\\]+/g, '_')
    .replace(/[^a-zA-Z0-9_.-]+/g, '_')
    .replace(/\.\.+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  // Evite les segments spéciaux qui peuvent remonter dans l'arborescence.
  if (!cleaned || cleaned === '.' || cleaned === '..') {
    return 'unknown';
  }

  return cleaned;
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

function buildArchiveDirectory({
  baseDir = getDefaultArchiveBaseDir(),
  hostName,
  year,
  month,
  week,
  day,
}) {
  return path.join(
    baseDir,
    'hosts',
    sanitizePathPart(hostName || 'unknown'),
    `year=${year}`,
    `month=${pad2(month)}`,
    `week=${pad2(week)}`,
    `day=${pad2(day)}`
  );
}

function buildArchivePath({
  baseDir = getDefaultArchiveBaseDir(),
  hostName,
  year,
  month,
  week,
  day,
  processName,
}) {
  return path.join(
    buildArchiveDirectory({ baseDir, hostName, year, month, week, day }),
    `${sanitizePathPart(processName || 'unknown')}.jsonl.zst`
  );
}

module.exports = {
  buildArchiveDirectory,
  buildArchivePath,
  getDefaultArchiveBaseDir,
  pad2,
  sanitizePathPart,
};
