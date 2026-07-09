const assert = require('node:assert/strict');
const test = require('node:test');

const { parseJournalLog } = require('../src/logs/parser/journalParser');
const { normalizeLog } = require('../src/logs/normalizeLog');

test('parseJournalLog parses a journalctl line with process id', () => {
  const parsed = parseJournalLog(
    'juil. 08 03:14:09 localhost NetworkManager[866]: dhcp4 (wlan0): new lease, address=192.168.1.42',
    { year: 2026 }
  );

  assert.equal(parsed.parser_status, 'success');
  assert.equal(parsed.event_timestamp, '2026-07-08T03:14:09.000Z');
  assert.equal(parsed.host_name, 'localhost');
  assert.equal(parsed.process_name, 'NetworkManager');
  assert.equal(parsed.process_id, '866');
  assert.equal(parsed.message, 'dhcp4 (wlan0): new lease, address=192.168.1.42');
});

test('parseJournalLog parses a journalctl line without process id', () => {
  const parsed = parseJournalLog(
    'juil. 08 03:14:17 localhost kernel: [UFW BLOCK] IN=wlan0 OUT= MAC=aa:bb:cc:dd:ee:ff',
    { year: 2026 }
  );

  assert.equal(parsed.parser_status, 'success');
  assert.equal(parsed.process_name, 'kernel');
  assert.equal(parsed.process_id, null);
});

test('normalizeLog returns a system_event_logs-compatible NetworkManager event', () => {
  const event = normalizeLog(
    'juil. 08 03:14:09 localhost NetworkManager[866]: supplicant interface state: associating -> completed',
    { year: 2026 }
  );

  assert.equal(event.source_name, 'journalctl');
  assert.equal(event.source_type, 'system');
  assert.equal(event.service, 'NetworkManager');
  assert.equal(event.event_type, 'network_supplicant_state_changed');
  assert.equal(event.severity, 'low');
  assert.equal(event.message, 'supplicant interface state: associating -> completed');
  assert.equal(event.raw_payload.parser, 'journalParser');
  assert.equal(event.raw_payload.parser_status, 'success');
  assert.equal(event.normalized_payload.from_state, 'associating');
  assert.equal(event.normalized_payload.to_state, 'completed');
  assert.equal(Object.prototype.hasOwnProperty.call(event.raw_payload, 'raw_log'), false);
});

test('normalizeLog extracts NetworkManager dhcp4 new lease details', () => {
  const event = normalizeLog(
    'juil. 08 03:14:09 localhost NetworkManager[866]: <info> [1783480449.6451] dhcp4 (wlan0): state changed new lease, address=192.168.43.197',
    { year: 2026 }
  );

  assert.equal(event.event_type, 'network_dhcp_lease_acquired');
  assert.equal(event.description, 'NetworkManager a obtenu l’adresse IP 192.168.43.197 sur l’interface wlan0.');
  assert.deepEqual(event.normalized_payload, {
    interface: 'wlan0',
    ip: '192.168.43.197',
    protocol: 'dhcp4',
    action: 'dhcp4_new_lease',
    process_name: 'NetworkManager',
    process_id: '866',
  });
});

test('normalizeLog handles wpa_supplicant disconnect events', () => {
  const event = normalizeLog(
    'août 08 10:11:12 localhost wpa_supplicant[901]: wlan0: CTRL-EVENT-DISCONNECTED bssid=00:11:22:33:44:55 reason=3 locally_generated=1',
    { year: 2026 }
  );

  assert.equal(event.event_type, 'wifi_disconnected');
  assert.equal(event.severity, 'medium');
  assert.equal(event.category, 'network');
  assert.equal(event.normalized_payload.bssid, '00:11:22:33:44:55');
});

test('normalizeLog handles kernel firewall blocks', () => {
  const event = normalizeLog(
    'sept. 09 12:13:14 localhost kernel: [UFW BLOCK] IN=wlan0 OUT= SRC=10.0.0.4 DST=10.0.0.5',
    { year: 2026 }
  );

  assert.equal(event.event_type, 'firewall_block');
  assert.equal(event.severity, 'high');
  assert.equal(event.category, 'security');
});

test('normalizeLog falls back to unknown normalizer', () => {
  const event = normalizeLog(
    'déc. 31 23:59:59 localhost custom-process[42]: something happened',
    { year: 2026 }
  );

  assert.equal(event.event_type, 'unknown_event');
  assert.equal(event.severity, 'low');
  assert.equal(event.category, 'unknown');
  assert.equal(event.interpretation_confidence, 0.2);
  assert.equal(event.message, 'something happened');
});
