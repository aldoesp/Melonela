const os = require('os');
const { detectEventType, detectSeverity, timestampFromJournalctl } = require('../logNormalizerService');
const { maskSensitivePayload, maskSensitiveText } = require('../sensitiveMaskingService');

function getService(rawLog) {
  return rawLog.SYSLOG_IDENTIFIER || rawLog._COMM || rawLog._SYSTEMD_UNIT || 'journalctl';
}

function buildUsefulRawPayload(rawLog, parserStatus = 'success') {
  return {
    parser: 'journalParser',
    parser_status: parserStatus,
    technical_severity: rawLog.PRIORITY || rawLog.LOG_LEVEL || null,
    journal_cursor: rawLog.__CURSOR || null,
    boot_id: rawLog._BOOT_ID || null,
    machine_id: rawLog._MACHINE_ID || null,
    transport: rawLog._TRANSPORT || null,
    uid: rawLog._UID || null,
    gid: rawLog._GID || null,
  };
}

function parseGenericJournalctl(rawLog, overrides = {}) {
  const hostName = rawLog._HOSTNAME || os.hostname() || 'localhost';
  const processName = rawLog._COMM || rawLog.SYSLOG_IDENTIFIER || null;
  const service = overrides.service || getService(rawLog);
  const rawMessage = String(rawLog.MESSAGE || '').trim() || 'Événement journalctl sans message';
  const eventType = overrides.event_type || detectEventType(rawMessage);
  const message = maskSensitiveText(overrides.message || rawMessage);

  return {
    source_name: 'journalctl',
    source_type: 'system',
    service,
    process_name: processName,
    process_id: rawLog._PID || null,
    host_name: hostName,
    event_type: eventType,
    severity: overrides.severity || detectSeverity(rawMessage, eventType),
    username: overrides.username || null,
    tty: overrides.tty || null,
    working_directory: overrides.working_directory || null,
    target_user: overrides.target_user || null,
    command: overrides.command ? maskSensitiveText(overrides.command) : null,
    message,
    event_timestamp: timestampFromJournalctl(rawLog),
    raw_payload: maskSensitivePayload(buildUsefulRawPayload(rawLog)),
    normalized_payload: {
      hostname: hostName,
      service,
      process_name: processName,
      process_id: rawLog._PID || null,
      uid: rawLog._UID || null,
      transport: rawLog._TRANSPORT || null,
      systemd_unit: rawLog._SYSTEMD_UNIT || rawLog.UNIT || null,
      syslog_identifier: rawLog.SYSLOG_IDENTIFIER || null,
      ...overrides.normalized_payload,
    },
  };
}

module.exports = {
  buildUsefulRawPayload,
  parseGenericJournalctl,
};
