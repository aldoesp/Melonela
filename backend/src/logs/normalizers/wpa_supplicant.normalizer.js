function extractMacAddress(message) {
  return message.match(/\b(?<mac>[0-9a-f]{2}(?::[0-9a-f]{2}){5})\b/i)?.groups?.mac || null;
}

function normalizeWpaSupplicant(parsedLog) {
  const message = parsedLog.message || '';
  const lower = message.toLowerCase();
  const bssid = extractMacAddress(message);

  if (message.includes('CTRL-EVENT-DISCONNECTED')) {
    return {
      event_type: 'wifi_disconnected',
      severity: 'medium',
      technical_severity: 'warning',
      category: 'network',
      title: 'Wi-Fi déconnecté',
      description: 'wpa_supplicant a signalé une déconnexion Wi-Fi.',
      interpretation_rule_id: 'wpa_supplicant_disconnected',
      interpretation_confidence: 0.9,
      normalized_payload: { bssid, action: 'disconnected' },
    };
  }

  if (message.includes('CTRL-EVENT-CONNECTED')) {
    return {
      event_type: 'wifi_connected',
      severity: 'low',
      technical_severity: 'info',
      category: 'network',
      title: 'Wi-Fi connecté',
      description: 'wpa_supplicant a établi une connexion Wi-Fi.',
      interpretation_rule_id: 'wpa_supplicant_connected',
      interpretation_confidence: 0.9,
      normalized_payload: { bssid, action: 'connected' },
    };
  }

  if (message.includes('CTRL-EVENT-BEACON-LOSS')) {
    return {
      event_type: 'wifi_beacon_loss',
      severity: 'medium',
      technical_severity: 'warning',
      category: 'network',
      title: 'Perte de beacon Wi-Fi',
      description: 'wpa_supplicant a détecté une perte de beacon Wi-Fi.',
      interpretation_rule_id: 'wpa_supplicant_beacon_loss',
      interpretation_confidence: 0.85,
      normalized_payload: { bssid, action: 'beacon_loss' },
    };
  }

  if (message.includes('WPA: Key negotiation completed')) {
    return {
      event_type: 'wifi_key_negotiation_completed',
      severity: 'low',
      technical_severity: 'info',
      category: 'authentication',
      title: 'Négociation WPA terminée',
      description: 'La négociation de clé WPA est terminée.',
      interpretation_rule_id: 'wpa_supplicant_key_negotiation_completed',
      interpretation_confidence: 0.85,
      normalized_payload: { bssid, action: 'key_negotiation_completed' },
    };
  }

  if (lower.includes('trying to associate')) {
    return {
      event_type: 'wifi_association_attempt',
      severity: 'low',
      technical_severity: 'info',
      category: 'network',
      title: 'Tentative d’association Wi-Fi',
      description: 'wpa_supplicant tente de s’associer à un point d’accès.',
      interpretation_rule_id: 'wpa_supplicant_association_attempt',
      interpretation_confidence: 0.8,
      normalized_payload: { bssid, action: 'association_attempt' },
    };
  }

  if (lower.includes('associated with')) {
    return {
      event_type: 'wifi_associated',
      severity: 'low',
      technical_severity: 'info',
      category: 'network',
      title: 'Association Wi-Fi établie',
      description: 'wpa_supplicant est associé à un point d’accès.',
      interpretation_rule_id: 'wpa_supplicant_associated',
      interpretation_confidence: 0.85,
      normalized_payload: { bssid, action: 'associated' },
    };
  }

  return null;
}

module.exports = {
  normalizeWpaSupplicant,
};
