const { buildLogFingerprint } = require('../fingerprint/buildLogFingerprint');
const { buildUnknownEvent } = require('../fallback/buildUnknownEvent');
const { CRON_RULES } = require('./cron.rules');
const { KERNEL_RULES } = require('./kernel.rules');
const { normalizeKernel } = require('./kernel.normalizer');
const { normalizeNetworkManager } = require('./NetworkManager.normalizer');
const { normalizePcUsage } = require('./pcUsage.normalizer');
const { normalizeWpaSupplicant } = require('./wpa_supplicant.normalizer');
const { PC_USAGE_RULES } = require('./pcUsage.rules');
const { SUDO_RULES } = require('./sudo.rules');
const { SYSTEMD_RULES } = require('./systemd.rules');

const RULES_BY_SERVICE = {
  CRON: CRON_RULES,
  cron: CRON_RULES,
  kernel: KERNEL_RULES,
  'pc_usage.sh': PC_USAGE_RULES,
  sudo: SUDO_RULES,
  systemd: SYSTEMD_RULES,
};

const NORMALIZERS = {
  NetworkManager: normalizeNetworkManager,
  'pc_usage.sh': normalizePcUsage,
  wpa_supplicant: normalizeWpaSupplicant,
  kernel: normalizeKernel,
};

function normalizeSeverity(severity) {
  if (['low', 'medium', 'high', 'critical'].includes(severity)) return severity;
  return 'low';
}

function technicalSeverityFor(severity) {
  if (severity === 'critical' || severity === 'high') return 'error';
  if (severity === 'medium') return 'warning';
  return 'info';
}

function applyRule(parsedLog, rule) {
  const message = parsedLog.message || '';
  const match = message.match(rule.pattern);

  if (!match?.groups) {
    return null;
  }

  const groups = match.groups;
  const fields = typeof rule.buildFields === 'function'
    ? rule.buildFields(groups)
    : groups;
  const description = typeof rule.buildDescription === 'function'
    ? rule.buildDescription(groups)
    : rule.description || rule.title;
  const severity = normalizeSeverity(
    typeof rule.severity === 'function' ? rule.severity(fields) : rule.severity
  );

  return {
    event_type: rule.event_type,
    severity,
    technical_severity: technicalSeverityFor(severity),
    category: rule.category,
    title: rule.title,
    description,
    interpretation_rule_id: rule.id,
    interpretation_confidence: rule.interpretation_confidence ?? rule.confidence ?? 0.9,
    normalized_payload: {
      ...fields,
      action: rule.id,
      fingerprint: buildLogFingerprint(message),
      message,
      raw_message: parsedLog.message,
      normalized: true,
      needs_rule: false,
      rule_id: rule.id,
      icon: rule.icon,
      parser_version: 'melonela-normalizer-commonjs-v1',
    },
  };
}

function applyServiceNormalizers(parsedLog) {
  const service = parsedLog.service || parsedLog.process_name || 'unknown';
  const rules = RULES_BY_SERVICE[service];

  if (!rules) {
    return null;
  }

  for (const rule of rules) {
    const normalized = applyRule(parsedLog, rule);
    if (normalized) return normalized;
  }

  return null;
}

function buildRawFallback(parsedLog) {
  const processName = parsedLog.process_name || parsedLog.service || 'unknown';
  const unknown = buildUnknownEvent({
    rawLine: parsedLog.rawLine,
    rawMessage: parsedLog.message,
    service: processName,
    processName,
    processId: parsedLog.process_id,
    hostName: parsedLog.host_name,
    cleanedMessage: parsedLog.message,
  });

  return {
    event_type: unknown.event_type,
    severity: unknown.severity,
    technical_severity: 'info',
    category: unknown.category,
    title: unknown.title,
    description: unknown.description,
    interpretation_rule_id: 'unknown_fingerprint',
    interpretation_confidence: 0.2,
    normalized_payload: {
      action: 'unknown_fingerprint',
      fingerprint: unknown.fingerprint,
      message: unknown.message,
      raw_message: unknown.raw_message,
      normalized: false,
      needs_rule: true,
      parser_version: unknown.parser_version,
    },
  };
}

function normalizeParsedLog(parsedLog) {
  const processName = parsedLog.process_name || 'unknown';
  const interpreted = applyServiceNormalizers(parsedLog);

  if (interpreted) {
    return interpreted;
  }

  const normalizer = NORMALIZERS[processName];
  const normalized = normalizer ? normalizer(parsedLog) : null;

  return normalized || buildRawFallback(parsedLog);
}

module.exports = {
  NORMALIZERS,
  RULES_BY_SERVICE,
  applyRule,
  applyServiceNormalizers,
  buildRawFallback,
  normalizeParsedLog,
};
