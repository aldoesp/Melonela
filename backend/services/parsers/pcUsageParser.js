const { normalizePcUsage } = require('../../src/logs/normalizers/pcUsage.normalizer');
const { parseGenericJournalctl } = require('./genericJournalctlParser');

function parsePcUsageLog(rawLog) {
  const processName = rawLog._COMM || rawLog.SYSLOG_IDENTIFIER || 'pc_usage.sh';
  const parsedLog = {
    process_name: processName,
    process_id: rawLog._PID || null,
    message: String(rawLog.MESSAGE || '').trim(),
    parser_status: 'success',
  };

  const normalized = normalizePcUsage(parsedLog);
  if (!normalized) {
    return parseGenericJournalctl(rawLog, {
      service: 'pc_usage.sh',
    });
  }

  const event = parseGenericJournalctl(rawLog, {
    service: 'pc_usage.sh',
    event_type: normalized.event_type,
    severity: normalized.severity,
    normalized_payload: normalized.normalized_payload,
  });

  return {
    ...event,
    title: normalized.title,
    description: normalized.description,
    category: normalized.category,
    human_severity: normalized.severity,
    interpretation_rule_id: normalized.interpretation_rule_id,
    interpretation_confidence: normalized.interpretation_confidence,
    raw_payload: {
      ...event.raw_payload,
      technical_severity: normalized.technical_severity,
    },
  };
}

module.exports = {
  parsePcUsageLog,
};
