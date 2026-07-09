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
  assert.equal(interpreted.event_type, 'network_dhcp_lease_acquired');
  assert.equal(interpreted.description, 'NetworkManager a obtenu l’adresse IP 192.168.43.197 sur l’interface wlan0.');
  assert.equal(interpreted.title, 'Bail DHCP obtenu');
  assert.equal(interpreted.category, 'network');
  assert.deepEqual(interpreted.normalized_payload, {
    hostname: 'localhost',
    service: 'NetworkManager',
    process_name: 'NetworkManager',
    process_id: '866',
    uid: null,
    transport: null,
    systemd_unit: null,
    syslog_identifier: 'NetworkManager',
    interface: 'wlan0',
    ip: '192.168.43.197',
    protocol: 'dhcp4',
    action: 'dhcp4_new_lease',
  });
  assert.equal(Object.prototype.hasOwnProperty.call(interpreted.raw_payload, 'raw_log'), false);
});
