const { buildLogFingerprint } = require('../fingerprint/buildLogFingerprint');
const { PC_USAGE_RULES } = require('./pcUsage.rules');

function getNamedGroups(match) {
  return match?.groups || {};
}

function normalizeWithRule(parsedLog, rule) {
  const message = parsedLog.message || '';
  const match = message.match(rule.pattern);
  if (!match) return null;

  const fields = getNamedGroups(match);
  const ruleFields = typeof rule.buildFields === 'function'
    ? rule.buildFields(fields)
    : fields;
  const description = typeof rule.buildDescription === 'function'
    ? rule.buildDescription(fields)
    : rule.description || rule.title;

  return {
    event_type: rule.event_type,
    severity: rule.severity,
    technical_severity: 'info',
    category: rule.category,
    title: rule.title,
    description,
    interpretation_rule_id: rule.id,
    interpretation_confidence: rule.interpretation_confidence ?? rule.confidence ?? 0.9,
    normalized_payload: {
      ...ruleFields,
      action: rule.id,
      fingerprint: buildLogFingerprint(message),
      message,
      raw_message: parsedLog.message,
      normalized: true,
      needs_rule: false,
      rule_id: rule.id,
      parser_version: 'melonela-normalizer-commonjs-v1',
    },
  };
}

function normalizePcUsage(parsedLog) {
  const processName = parsedLog.process_name || parsedLog.service || '';

  if (processName !== 'pc_usage.sh') {
    return null;
  }

  for (const rule of PC_USAGE_RULES) {
    const normalized = normalizeWithRule(parsedLog, rule);
    if (normalized) return normalized;
  }

  return null;
}

module.exports = {
  PC_USAGE_RULES,
  normalizePcUsage,
};
