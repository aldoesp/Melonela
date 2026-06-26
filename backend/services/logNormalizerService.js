const os = require('os');

function timestampFromJournalctl(rawLog) {
  if (rawLog.__REALTIME_TIMESTAMP) {
    const micros = Number(rawLog.__REALTIME_TIMESTAMP);
    if (Number.isFinite(micros)) {
      return new Date(Math.floor(micros / 1000)).toISOString();
    }
  }

  if (rawLog._SOURCE_REALTIME_TIMESTAMP) {
    const micros = Number(rawLog._SOURCE_REALTIME_TIMESTAMP);
    if (Number.isFinite(micros)) {
      return new Date(Math.floor(micros / 1000)).toISOString();
    }
  }

  return new Date().toISOString();
}

function detectEventType(message) {
  const text = message || '';
  const lower = text.toLowerCase();

  if (text.includes('Failed password')) return 'ssh_failed';
  if (text.includes('Started')) return 'service_started';
  if (text.includes('Stopped')) return 'service_stopped';
  if (lower.includes('error') || lower.includes('failed')) return 'system_error';

  return 'system_event';
}

function detectSeverity(message, eventType) {
  const lower = (message || '').toLowerCase();

  if (lower.includes('panic') || lower.includes('fatal') || lower.includes('critical')) {
    return 'critical';
  }

  if (
    eventType === 'ssh_failed'
    || lower.includes('permission denied')
    || lower.includes('segmentation fault')
    || lower.includes('service failed')
  ) {
    return 'high';
  }

  if (lower.includes('error') || lower.includes('failed')) {
    return 'medium';
  }

  return 'low';
}

// Convertit un log journalctl brut vers la norme Melonela V1.
function normalizeJournalctlLog(rawLog) {
  const message = String(rawLog.MESSAGE || rawLog.message || '').trim();
  const eventType = detectEventType(message);
  const severity = detectSeverity(message, eventType);
  const sourceName = rawLog._HOSTNAME || os.hostname() || 'localhost';
  const systemdUnit = rawLog._SYSTEMD_UNIT || rawLog.UNIT || null;

  return {
    source_name: sourceName,
    source_type: 'journalctl',
    event_type: eventType,
    severity,
    message: message || 'Événement journalctl sans message',
    event_timestamp: timestampFromJournalctl(rawLog),
    raw_payload: rawLog,
    normalized_payload: {
      hostname: sourceName,
      systemd_unit: systemdUnit,
      pid: rawLog._PID || null,
      uid: rawLog._UID || null,
      transport: rawLog._TRANSPORT || null,
      syslog_identifier: rawLog.SYSLOG_IDENTIFIER || null,
    },
  };
}

module.exports = {
  normalizeJournalctlLog,
  detectEventType,
  detectSeverity,
};
