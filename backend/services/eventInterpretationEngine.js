const { buildHumanEvent } = require('./humanEventBuilder');
const { findMatchingRule } = require('./ruleEngine');
const { loadInterpretationRules } = require('./ruleLoaderService');

const FALLBACK_HUMAN_EVENT = {
  title: 'Événement système détecté',
  description: 'Un événement système a été enregistré par journalctl.',
  category: 'System',
  icon: 'server',
  human_severity: 'low',
  interpretation_rule_id: 'fallback_generic',
  interpretation_confidence: 0.30,
};

function interpret(event) {
  const rules = loadInterpretationRules();
  const rule = findMatchingRule(event, rules);

  if (!rule) {
    return {
      ...event,
      ...FALLBACK_HUMAN_EVENT,
    };
  }

  return {
    ...event,
    ...buildHumanEvent(event, rule),
  };
}

module.exports = {
  interpret,
  FALLBACK_HUMAN_EVENT,
};
