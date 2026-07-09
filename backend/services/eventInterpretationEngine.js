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
      ...FALLBACK_HUMAN_EVENT,
      ...event,
      title: event.title || FALLBACK_HUMAN_EVENT.title,
      description: event.description || FALLBACK_HUMAN_EVENT.description,
      category: event.category || FALLBACK_HUMAN_EVENT.category,
      icon: event.icon || FALLBACK_HUMAN_EVENT.icon,
      human_severity: event.human_severity || FALLBACK_HUMAN_EVENT.human_severity,
      interpretation_rule_id: event.interpretation_rule_id || FALLBACK_HUMAN_EVENT.interpretation_rule_id,
      interpretation_confidence: event.interpretation_confidence ?? FALLBACK_HUMAN_EVENT.interpretation_confidence,
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
