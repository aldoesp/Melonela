const { parseGenericJournalctl } = require('./genericJournalctlParser');

function parseSystemdLog(rawLog) {
  const message = String(rawLog.MESSAGE || '');
  let eventType = 'systemd_event';

  if (message.includes('Started')) eventType = 'service_started';
  if (message.includes('Starting')) eventType = 'service_starting';
  if (message.includes('Stopped')) eventType = 'service_stopped';
  if (message.includes('Failed')) eventType = 'service_failed';

  return parseGenericJournalctl(rawLog, {
    service: rawLog.SYSLOG_IDENTIFIER || 'systemd',
    event_type: eventType,
    severity: eventType === 'service_failed' ? 'high' : undefined,
  });
}

module.exports = {
  parseSystemdLog,
};
