const VALID_SEVERITIES = new Set(['low', 'medium', 'high', 'critical']);

// Valide qu'un événement respecte la norme Melonela avant stockage.
function validateMelonelaLog(log) {
  const errors = [];

  ['source_name', 'source_type', 'event_type', 'severity', 'message', 'event_timestamp'].forEach((field) => {
    if (!log[field]) errors.push(`${field} est obligatoire`);
  });

  if (log.severity && !VALID_SEVERITIES.has(log.severity)) {
    errors.push('severity doit être low, medium, high ou critical');
  }

  if (log.event_timestamp && Number.isNaN(Date.parse(log.event_timestamp))) {
    errors.push('event_timestamp doit être une date ISO valide');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

module.exports = {
  validateMelonelaLog,
  VALID_SEVERITIES,
};
