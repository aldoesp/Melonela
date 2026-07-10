function buildLogFingerprint(message) {
  if (!message || typeof message !== 'string') {
    return 'unknown';
  }

  return message
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '<ipv4>')
    .replace(/\b[0-9A-Fa-f]{2}(?::[0-9A-Fa-f]{2}){5}\b/g, '<mac>')
    .replace(
      /\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/g,
      '<uuid>'
    )
    .replace(/\[[0-9]+\.[0-9]+\]/g, '[<nm_time>]')
    .replace(
      /\b(?:wlan|eth|enp|ens|wlp|tun|docker|virbr|veth|br-)[a-zA-Z0-9_.:-]*\b/g,
      '<iface>'
    )
    .replace(/'[^']*'/g, "'<value>'")
    .replace(/"[^"]*"/g, '"<value>"')
    .replace(/\s+/g, ' ')
    .trim();
}

module.exports = {
  buildLogFingerprint,
};
