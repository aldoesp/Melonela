const { buildLogFingerprint } = require('../fingerprint/buildLogFingerprint');

function inferUnknownCategory(service, message) {
  const text = `${service || ''} ${message || ''}`.toLowerCase();

  if (
    text.includes('network')
    || text.includes('dhcp')
    || text.includes('wifi')
    || text.includes('wlan')
    || text.includes('ethernet')
    || text.includes('dns')
  ) {
    return 'network';
  }

  if (
    text.includes('auth')
    || text.includes('password')
    || text.includes('permission')
    || text.includes('denied')
    || text.includes('secret')
  ) {
    return 'security';
  }

  if (
    text.includes('kernel')
    || text.includes('firmware')
    || text.includes('driver')
  ) {
    return 'kernel';
  }

  if (
    text.includes('service')
    || text.includes('daemon')
    || text.includes('systemd')
  ) {
    return 'service';
  }

  return 'system';
}

function inferUnknownSeverity(message) {
  const text = String(message || '').toLowerCase();

  if (
    text.includes('denied')
    || text.includes('unauthorized')
    || text.includes('authentication failed')
  ) {
    return 'high';
  }

  if (
    text.includes('failed')
    || text.includes('failure')
    || text.includes('timeout')
    || text.includes('timed out')
    || text.includes('unreachable')
  ) {
    return 'medium';
  }

  return 'low';
}

function buildUnknownEvent(input = {}) {
  const cleanedMessage = input.cleanedMessage || input.message || input.rawMessage || '';
  const fallbackMessage = cleanedMessage || input.rawLine || 'Message journalctl indisponible';
  const fingerprint = buildLogFingerprint(cleanedMessage);

  return {
    source_name: input.sourceName || 'journalctl',
    source_type: 'system',
    service: input.service || 'unknown',
    process_name: input.processName || input.service || 'unknown',
    process_id: input.processId || null,
    host_name: input.hostName || null,
    event_type: 'system_event_unknown',
    category: inferUnknownCategory(input.service, cleanedMessage),
    severity: inferUnknownSeverity(cleanedMessage),
    title: fallbackMessage,
    description: fallbackMessage,
    normalized: false,
    needs_rule: true,
    raw_message: input.rawLine || input.rawMessage || cleanedMessage,
    message: cleanedMessage,
    cleaned_message: cleanedMessage,
    fingerprint,
    parser_version: 'melonela-normalizer-commonjs-v1',
  };
}

module.exports = {
  buildUnknownEvent,
  inferUnknownCategory,
  inferUnknownSeverity,
};
