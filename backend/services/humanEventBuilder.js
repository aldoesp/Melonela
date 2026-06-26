const SUPPORTED_VARIABLES = [
  'username',
  'target_user',
  'host_name',
  'service',
  'command',
  'working_directory',
  'event_type',
];

function getReadableValue(event, key) {
  const value = event[key];
  if (value === null || value === undefined || value === '') return 'inconnu';
  return String(value);
}

function renderTemplate(template, event) {
  if (!template) return '';

  return template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key) => {
    if (!SUPPORTED_VARIABLES.includes(key)) return 'inconnu';
    return getReadableValue(event, key);
  });
}

function buildHumanEvent(event, rule) {
  const human = rule.human || {};

  return {
    title: human.title || 'Événement système détecté',
    description: renderTemplate(human.description, event),
    category: human.category || 'System',
    icon: human.icon || 'server',
    human_severity: human.severity || event.severity || 'low',
    interpretation_rule_id: rule.id,
    interpretation_confidence: 0.95,
  };
}

module.exports = {
  buildHumanEvent,
  renderTemplate,
};
