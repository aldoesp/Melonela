const { buildLogFingerprint } = require('./fingerprint/buildLogFingerprint');
const { buildUnknownEvent } = require('./fallback/buildUnknownEvent');
const { parseJournalctlLine } = require('./journalctlParser');
const { normalizeParsedLog } = require('./normalizers');

function normalizeLog(rawLine, options = {}) {
  const baseEvent = parseJournalctlLine(rawLine, options);

  if (!baseEvent.parsed) {
    const unknown = buildUnknownEvent({
      rawLine,
      service: 'unknown',
      cleanedMessage: rawLine,
    });

    return {
      source_name: unknown.source_name,
      source_type: unknown.source_type,
      service: unknown.service,
      process_name: unknown.process_name,
      process_id: unknown.process_id,
      host_name: unknown.host_name,
      event_type: unknown.event_type,
      severity: unknown.severity,
      message: unknown.message,
      title: unknown.title,
      description: unknown.description,
      category: unknown.category,
      human_severity: unknown.severity,
      interpretation_rule_id: 'unknown_fingerprint',
      interpretation_confidence: 0.2,
      raw_payload: {
        parser: 'journalctlParser',
        parser_status: 'failed',
        raw_message: unknown.raw_message,
        fingerprint: unknown.fingerprint,
      },
      normalized_payload: {
        normalized: false,
        needs_rule: true,
        fingerprint: unknown.fingerprint,
        parser_version: unknown.parser_version,
      },
      event_timestamp: new Date(options.now || Date.now()).toISOString(),
    };
  }

  const parsedLog = {
    rawLine: baseEvent.rawLine,
    event_timestamp: baseEvent.event_timestamp,
    host_name: baseEvent.host_name,
    process_name: baseEvent.process_name,
    process_id: baseEvent.process_id,
    message: baseEvent.message,
    parser_status: 'success',
    parser_error: null,
  };
  const normalized = normalizeParsedLog(parsedLog);
  const processName = parsedLog.process_name || 'unknown';
  const fingerprint = buildLogFingerprint(
    normalized.normalized_payload?.message || parsedLog.message
  );

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
      parser: 'journalctlParser',
      parser_status: parsedLog.parser_status,
      parser_error: parsedLog.parser_error || null,
      technical_severity: normalized.technical_severity,
      has_process_id: Boolean(parsedLog.process_id),
      fingerprint,
    },
    normalized_payload: {
      ...normalized.normalized_payload,
      process_name: processName,
      process_id: parsedLog.process_id,
      fingerprint: normalized.normalized_payload?.fingerprint || fingerprint,
    },
    event_timestamp: parsedLog.event_timestamp,
  };
}

module.exports = {
  normalizeLog,
};
