const SENSITIVE_KEYWORDS = [
  'password',
  'passwd',
  'token',
  'secret',
  'api_key',
  'authorization',
  'bearer',
];

// Masque les secrets courants avant stockage et affichage.
function maskSensitiveText(value) {
  if (!value) return value;
  let text = String(value);

  text = text.replace(/(Authorization\s*:\s*Bearer\s+)([^\s"']+)/gi, '$1***');
  text = text.replace(/(Bearer\s+)([A-Za-z0-9._~+/=-]{6,})/gi, '$1***');

  for (const keyword of SENSITIVE_KEYWORDS) {
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    text = text.replace(new RegExp(`(${escaped}\\s*[=:]\\s*)([^\\s;&"']+)`, 'gi'), '$1***');
    text = text.replace(new RegExp(`(--${escaped}\\s+)([^\\s;&"']+)`, 'gi'), '$1***');
  }

  return text;
}

function maskSensitivePayload(payload) {
  if (!payload || typeof payload !== 'object') return payload;

  return Object.fromEntries(
    Object.entries(payload).map(([key, value]) => [
      key,
      typeof value === 'string' ? maskSensitiveText(value) : value,
    ])
  );
}

module.exports = {
  maskSensitiveText,
  maskSensitivePayload,
};
