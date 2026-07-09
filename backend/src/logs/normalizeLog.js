const { parseJournalLog } = require('./parser/journalParser');
const { normalizeParsedLog } = require('./normalizers');

function normalizeLog(rawLine, options = {}) {
  const parsedLog = parseJournalLog(rawLine, options);
  const normalized = normalizeParsedLog(parsedLog);
  const processName = parsedLog.process_name || 'unknown';

  return {
    source_name: 'journalctl',
    source_type: 'system',
    service: processName,
    process_name: processName,
    process_id: parsedLog.process_id,
    host_name: parsedLog.host_name,
    event_type: normalized.event_type,
    severity: normalized.severity,
    message: parsedLog.message,
    title: normalized.title,
    description: normalized.description,
    category: normalized.category,
    human_severity: normalized.severity,
    interpretation_rule_id: normalized.interpretation_rule_id,
    interpretation_confidence: normalized.interpretation_confidence,
    raw_payload: {
      parser: 'journalParser',
      parser_status: parsedLog.parser_status,
      parser_error: parsedLog.parser_error || null,
      technical_severity: normalized.technical_severity,
      has_process_id: Boolean(parsedLog.process_id),
    },
    normalized_payload: {
      ...normalized.normalized_payload,
      process_name: processName,
      process_id: parsedLog.process_id,
    },
    event_timestamp: parsedLog.event_timestamp,
  };
}

module.exports = {
  normalizeLog,
};
