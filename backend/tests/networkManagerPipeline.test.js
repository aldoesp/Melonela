const assert = require('node:assert/strict');
const test = require('node:test');

const eventInterpretationEngine = require('../services/eventInterpretationEngine');
const { parseJournalctlLog } = require('../services/parserFactory');

test('journalctl JSON NetworkManager lease keeps precise description for UI', () => {
  const rawLog = {
    __REALTIME_TIMESTAMP: '1783480449645100',
    _HOSTNAME: 'localhost',
    _COMM: 'NetworkManager',
    SYSLOG_IDENTIFIER: 'NetworkManager',
    _PID: '866',
    MESSAGE: '<info> [1783480449.6451] dhcp4 (wlan0): state changed new lease, address=192.168.43.197',
  };

  const parsed = parseJournalctlLog(rawLog);
  const interpreted = eventInterpretationEngine.interpret(parsed);

  assert.equal(interpreted.source_name, 'journalctl');
  assert.equal(interpreted.source_type, 'system');
  assert.equal(interpreted.service, 'NetworkManager');
  assert.equal(interpreted.process_name, 'NetworkManager');
  assert.equal(interpreted.process_id, '866');
  assert.equal(interpreted.event_type, 'network_dhcp4_lease_acquired');
  assert.equal(interpreted.description, 'L’interface wlan0 a obtenu un bail DHCPv4 avec l’adresse 192.168.43.197.');
  assert.equal(interpreted.title, 'Bail DHCPv4 obtenu');
  assert.equal(interpreted.category, 'dhcp');
  assert.equal(interpreted.normalized_payload.hostname, 'localhost');
  assert.equal(interpreted.normalized_payload.service, 'NetworkManager');
  assert.equal(interpreted.normalized_payload.process_name, 'NetworkManager');
  assert.equal(interpreted.normalized_payload.process_id, '866');
  assert.equal(interpreted.normalized_payload.syslog_identifier, 'NetworkManager');
  assert.equal(interpreted.normalized_payload.interface, 'wlan0');
  assert.equal(interpreted.normalized_payload.ip, '192.168.43.197');
  assert.equal(interpreted.normalized_payload.ip_address, '192.168.43.197');
  assert.equal(interpreted.normalized_payload.action, 'nm_dhcp4_new_lease');
  assert.equal(interpreted.normalized_payload.nm_level, 'info');
  assert.equal(interpreted.normalized_payload.normalized, true);
  assert.equal(Object.prototype.hasOwnProperty.call(interpreted.raw_payload, 'raw_log'), false);
});
