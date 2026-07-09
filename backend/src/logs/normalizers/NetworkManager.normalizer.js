function baseEvent(message, overrides = {}) {
  return {
    event_type: overrides.event_type || 'networkmanager_event',
    severity: overrides.severity || 'low',
    technical_severity: overrides.technical_severity || 'info',
    category: overrides.category || 'network',
    title: overrides.title || 'Événement NetworkManager',
    description: overrides.description || message,
    interpretation_rule_id: overrides.interpretation_rule_id || 'networkmanager_generic',
    interpretation_confidence: overrides.interpretation_confidence ?? 0.5,
    normalized_payload: overrides.normalized_payload || {},
  };
}

function stripNetworkManagerPrefix(message) {
  return String(message || '')
    .replace(/^<[^>]+>\s*/, '')
    .replace(/^\[[^\]]+\]\s*/, '')
    .trim();
}

function normalizeDhcp4NewLease(parsedLog, message) {
  const match = message.match(/\bdhcp4\s+\(([^)]+)\):.*\bnew lease\b.*\baddress=([0-9]{1,3}(?:\.[0-9]{1,3}){3})\b/i);
  if (!match) return null;

  const [, networkInterface, ip] = match;

  return baseEvent(message, {
    event_type: 'network_dhcp_lease_acquired',
    severity: 'low',
    technical_severity: 'info',
    category: 'network',
    title: 'Bail DHCP obtenu',
    description: `NetworkManager a obtenu l’adresse IP ${ip} sur l’interface ${networkInterface}.`,
    interpretation_rule_id: 'networkmanager_dhcp4_new_lease',
    interpretation_confidence: 0.95,
    normalized_payload: {
      interface: networkInterface,
      ip,
      protocol: 'dhcp4',
      action: 'dhcp4_new_lease',
      process_name: parsedLog.process_name || 'NetworkManager',
      process_id: parsedLog.process_id || null,
    },
  });
}

function normalizeCanceledDhcp(parsedLog, message) {
  const match = message.match(/\bdhcp4\s+\(([^)]+)\):.*canceled DHCP transaction/i);
  if (!match) return null;

  return baseEvent(message, {
    event_type: 'network_dhcp_transaction_canceled',
    severity: 'medium',
    technical_severity: 'warning',
    category: 'network',
    title: 'Transaction DHCP annulée',
    description: `NetworkManager a annulé une transaction DHCP sur l’interface ${match[1]}.`,
    interpretation_rule_id: 'networkmanager_dhcp4_canceled',
    interpretation_confidence: 0.9,
    normalized_payload: {
      interface: match[1],
      protocol: 'dhcp4',
      action: 'dhcp4_canceled',
      process_name: parsedLog.process_name || 'NetworkManager',
      process_id: parsedLog.process_id || null,
    },
  });
}

function normalizeSupplicantState(parsedLog, message) {
  const match = message.match(/supplicant interface state:\s*([^\s]+)\s*->\s*([^\s]+)/i);
  if (!match) return null;

  return baseEvent(message, {
    event_type: 'network_supplicant_state_changed',
    severity: 'low',
    technical_severity: 'info',
    category: 'network',
    title: 'État Wi-Fi modifié',
    description: `NetworkManager a changé l’état supplicant de ${match[1]} vers ${match[2]}.`,
    interpretation_rule_id: 'networkmanager_supplicant_state_change',
    interpretation_confidence: 0.9,
    normalized_payload: {
      from_state: match[1],
      to_state: match[2],
      action: 'supplicant_state_changed',
      process_name: parsedLog.process_name || 'NetworkManager',
      process_id: parsedLog.process_id || null,
    },
  });
}

function normalizeDhcpRestarting(parsedLog, message) {
  const match = message.match(/\bip:dhcp4:\s*restarting/i);
  if (!match) return null;

  return baseEvent(message, {
    event_type: 'network_dhcp_restarting',
    severity: 'medium',
    technical_severity: 'warning',
    category: 'network',
    title: 'DHCP redémarré',
    description: 'NetworkManager redémarre la configuration DHCP IPv4.',
    interpretation_rule_id: 'networkmanager_dhcp4_restarting',
    interpretation_confidence: 0.85,
    normalized_payload: {
      protocol: 'dhcp4',
      action: 'dhcp4_restarting',
      process_name: parsedLog.process_name || 'NetworkManager',
      process_id: parsedLog.process_id || null,
    },
  });
}

function normalizeNetworkManager(parsedLog) {
  const message = stripNetworkManagerPrefix(parsedLog.message);
  const rules = [
    normalizeDhcp4NewLease,
    normalizeCanceledDhcp,
    normalizeSupplicantState,
    normalizeDhcpRestarting,
  ];

  for (const rule of rules) {
    const normalized = rule(parsedLog, message);
    if (normalized) return normalized;
  }

  return baseEvent(message, {
    event_type: 'networkmanager_event',
    severity: 'low',
    technical_severity: 'info',
    category: 'network',
    title: 'Événement NetworkManager',
    description: message,
    interpretation_rule_id: 'networkmanager_generic',
    interpretation_confidence: 0.4,
    normalized_payload: {
      action: 'networkmanager_event',
      process_name: parsedLog.process_name || 'NetworkManager',
      process_id: parsedLog.process_id || null,
    },
  });
}

module.exports = {
  normalizeNetworkManager,
};
