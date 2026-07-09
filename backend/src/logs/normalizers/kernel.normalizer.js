function extractMacAddress(message) {
  return message.match(/\b(?<mac>[0-9a-f]{2}(?::[0-9a-f]{2}){5})\b/i)?.groups?.mac || null;
}

function normalizeKernel(parsedLog) {
  const message = parsedLog.message || '';
  const lower = message.toLowerCase();
  const bssid = extractMacAddress(message);

  if (message.includes('[UFW BLOCK]')) {
    return {
      event_type: 'firewall_block',
      severity: 'high',
      technical_severity: 'warning',
      category: 'security',
      title: 'Trafic bloqué par UFW',
      description: 'Le noyau a signalé un paquet bloqué par le pare-feu UFW.',
      interpretation_rule_id: 'kernel_ufw_block',
      interpretation_confidence: 0.95,
      normalized_payload: {
        firewall: 'ufw',
        action: 'block',
      },
    };
  }

  if (lower.includes('failed to get tx report from firmware')) {
    return {
      event_type: 'kernel_wifi_firmware_tx_report_failed',
      severity: 'medium',
      technical_severity: 'warning',
      category: 'system',
      title: 'Rapport firmware Wi-Fi indisponible',
      description: 'Le noyau n’a pas pu obtenir un rapport TX depuis le firmware.',
      interpretation_rule_id: 'kernel_tx_report_failed',
      interpretation_confidence: 0.85,
      normalized_payload: {
        subsystem: 'wifi_firmware',
        action: 'tx_report_failed',
      },
    };
  }

  if (lower.includes('authenticated')) {
    return {
      event_type: 'kernel_wifi_authenticated',
      severity: 'low',
      technical_severity: 'info',
      category: 'authentication',
      title: 'Authentification Wi-Fi validée',
      description: 'Le noyau a signalé une authentification Wi-Fi réussie.',
      interpretation_rule_id: 'kernel_wifi_authenticated',
      interpretation_confidence: 0.85,
      normalized_payload: { bssid, action: 'authenticated' },
    };
  }

  if (lower.includes('associated')) {
    return {
      event_type: 'kernel_wifi_associated',
      severity: 'low',
      technical_severity: 'info',
      category: 'network',
      title: 'Association Wi-Fi validée',
      description: 'Le noyau a signalé une association Wi-Fi.',
      interpretation_rule_id: 'kernel_wifi_associated',
      interpretation_confidence: 0.85,
      normalized_payload: { bssid, action: 'associated' },
    };
  }

  if (lower.includes('authenticate with')) {
    return {
      event_type: 'kernel_wifi_authenticate_with',
      severity: 'low',
      technical_severity: 'info',
      category: 'authentication',
      title: 'Authentification Wi-Fi démarrée',
      description: 'Le noyau démarre une authentification Wi-Fi avec un point d’accès.',
      interpretation_rule_id: 'kernel_wifi_authenticate_with',
      interpretation_confidence: 0.8,
      normalized_payload: { bssid, action: 'authenticate_with' },
    };
  }

  if (lower.includes('send auth to')) {
    return {
      event_type: 'kernel_wifi_send_auth',
      severity: 'low',
      technical_severity: 'info',
      category: 'authentication',
      title: 'Authentification Wi-Fi envoyée',
      description: 'Le noyau a envoyé une requête d’authentification Wi-Fi.',
      interpretation_rule_id: 'kernel_wifi_send_auth',
      interpretation_confidence: 0.8,
      normalized_payload: { bssid, action: 'send_auth' },
    };
  }

  return null;
}

module.exports = {
  normalizeKernel,
};
