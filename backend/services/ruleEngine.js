const MATCH_FIELD_MAP = {
  service: 'service',
  event_type: 'event_type',
  source_type: 'source_type',
  username: 'username',
  target_user: 'target_user',
  process_name: 'process_name',
};

const CONTAINS_FIELD_MAP = {
  message_contains: 'message',
  command_contains: 'command',
  systemd_unit_contains: 'normalized_payload.systemd_unit',
};

function getValue(event, path) {
  return path.split('.').reduce((value, key) => {
    if (value && typeof value === 'object') return value[key];
    return undefined;
  }, event);
}

function normalize(value) {
  return String(value ?? '').toLowerCase();
}

function matchesExact(event, field, expected) {
  return normalize(getValue(event, field)) === normalize(expected);
}

function matchesContains(event, field, expected) {
  return normalize(getValue(event, field)).includes(normalize(expected));
}

function doesRuleMatch(event, rule) {
  const match = rule.match || {};

  for (const [matcher, field] of Object.entries(MATCH_FIELD_MAP)) {
    if (match[matcher] !== undefined && !matchesExact(event, field, match[matcher])) {
      return false;
    }
  }

  for (const [matcher, field] of Object.entries(CONTAINS_FIELD_MAP)) {
    if (match[matcher] !== undefined && !matchesContains(event, field, match[matcher])) {
      return false;
    }
  }

  return true;
}

function findMatchingRule(event, rules) {
  return rules.find((rule) => doesRuleMatch(event, rule)) || null;
}

module.exports = {
  doesRuleMatch,
  findMatchingRule,
};
