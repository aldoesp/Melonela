const { buildLogFingerprint } = require('../fingerprint/buildLogFingerprint');
const { buildUnknownEvent } = require('../fallback/buildUnknownEvent');
const { parseNetworkManagerMessage } = require('../journalctlParser');
const { NETWORK_MANAGER_RULES } = require('./networkManager.rules');

function getNamedGroups(match) {
  return match?.groups || {};
}

function normalizeSeverity(severity) {
  if (['low', 'medium', 'high', 'critical'].includes(severity)) return severity;
  return 'low';
}

function normalizeFields(fields) {
  const normalized = { ...fields };

  if (fields.interface && !normalized.iface) normalized.iface = fields.interface;
  if (fields.ip_address && !normalized.ip) normalized.ip = fields.ip_address;
  if (fields.connection && !normalized.connection_name) normalized.connection_name = fields.connection;
  if (fields.from_state && !normalized.state_from) normalized.state_from = fields.from_state;
  if (fields.to_state && !normalized.state_to) normalized.state_to = fields.to_state;
  if (fields.timeout_seconds) normalized.timeout_seconds = Number(fields.timeout_seconds);

  return normalized;
}

function normalizeWithRule(parsedLog, cleanedMessage, nm, rule) {
  const match = cleanedMessage.match(rule.pattern);
  if (!match) return null;

  const fields = normalizeFields(getNamedGroups(match));
  const ruleSeverity = typeof rule.severity === 'function'
    ? rule.severity(fields)
    : rule.severity;
  const description = typeof rule.buildDescription === 'function'
    ? rule.buildDescription(fields)
    : rule.description || rule.title;

  return {
    event_type: rule.event_type,
    severity: normalizeSeverity(ruleSeverity),
    technical_severity: nm.nm_level || ruleSeverity || 'info',
    category: rule.category,
    title: rule.title,
    description,
    interpretation_rule_id: rule.id,
    interpretation_confidence: rule.confidence ?? 0.95,
    normalized_payload: {
      ...fields,
      action: rule.id,
      fingerprint: buildLogFingerprint(cleanedMessage),
      message: cleanedMessage,
      raw_message: parsedLog.message,
      nm_level: nm.nm_level,
      nm_monotonic_time: nm.nm_monotonic_time,
      monotonic_timestamp: nm.nm_monotonic_time,
      normalized: true,
      needs_rule: false,
      rule_id: rule.id,
      parser_version: 'melonela-normalizer-commonjs-v1',
    },
  };
}

function normalizeNetworkManager(parsedLog) {
  const nm = parseNetworkManagerMessage(parsedLog.message);
  const cleanedMessage = nm.cleaned_message;

  for (const rule of NETWORK_MANAGER_RULES) {
    const normalized = normalizeWithRule(parsedLog, cleanedMessage, nm, rule);
    if (normalized) return normalized;
  }

  const unknown = buildUnknownEvent({
    rawLine: parsedLog.rawLine,
    rawMessage: parsedLog.message,
    service: 'NetworkManager',
    processName: parsedLog.process_name,
    processId: parsedLog.process_id,
    hostName: parsedLog.host_name,
    cleanedMessage,
  });

  return {
    event_type: unknown.event_type,
    severity: unknown.severity,
    technical_severity: nm.nm_level || 'info',
    category: unknown.category,
    title: unknown.title,
    description: unknown.description,
    interpretation_rule_id: 'networkmanager_unknown',
    interpretation_confidence: 0.2,
    normalized_payload: {
      action: 'networkmanager_unknown',
      fingerprint: unknown.fingerprint,
      message: cleanedMessage,
      raw_message: parsedLog.message,
      nm_level: nm.nm_level,
      nm_monotonic_time: nm.nm_monotonic_time,
      monotonic_timestamp: nm.nm_monotonic_time,
      normalized: false,
      needs_rule: true,
      parser_version: unknown.parser_version,
    },
  };
}

module.exports = {
  NETWORK_MANAGER_RULES,
  normalizeNetworkManager,
  parseNetworkManagerMessage,
};
