const os = require('os');
const { detectEventType, detectSeverity, timestampFromJournalctl } = require('../logNormalizerService');
const { maskSensitivePayload, maskSensitiveText } = require('../sensitiveMaskingService');

function getService(rawLog) {
  return rawLog.SYSLOG_IDENTIFIER || rawLog._COMM || rawLog._SYSTEMD_UNIT || 'journalctl';
}

function parseGenericJournalctl(rawLog, overrides = {}) {
  const hostName = rawLog._HOSTNAME || os.hostname() || 'localhost';
  const processName = rawLog._COMM || rawLog.SYSLOG_IDENTIFIER || null;
  const service = overrides.service || getService(rawLog);
  const rawMessage = String(rawLog.MESSAGE || '').trim() || 'Événement journalctl sans message';
  const eventType = overrides.event_type || detectEventType(rawMessage);
  const message = maskSensitiveText(overrides.message || rawMessage);

  return {
    source_name: hostName,
    source_type: 'journalctl',
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
    raw_payload: maskSensitivePayload(rawLog),
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
  parseGenericJournalctl,
};
