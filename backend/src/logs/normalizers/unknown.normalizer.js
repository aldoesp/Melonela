function normalizeUnknown(parsedLog) {
  const processName = parsedLog.process_name || 'unknown';

  return {
    event_type: 'unknown_event',
    severity: 'low',
    technical_severity: 'info',
    category: 'unknown',
    title: 'Événement non reconnu',
    description: `Événement reçu depuis ${processName}, mais aucun normaliseur précis ne correspond.`,
    interpretation_rule_id: 'unknown_generic',
    interpretation_confidence: 0.2,
    normalized_payload: {
      process_name: processName,
      parser_status: parsedLog.parser_status,
    },
  };
}

module.exports = {
  normalizeUnknown,
};
