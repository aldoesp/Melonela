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
  assert.equal(event.event_type, 'network_wifi_supplicant_state_changed');
  assert.equal(event.severity, 'low');
  assert.equal(event.message, 'supplicant interface state: associating -> completed');
  assert.equal(event.raw_payload.parser, 'journalctlParser');
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

  assert.equal(event.event_type, 'network_dhcp4_lease_acquired');
  assert.equal(event.description, 'L’interface wlan0 a obtenu un bail DHCPv4 avec l’adresse 192.168.43.197.');
  assert.equal(event.normalized_payload.interface, 'wlan0');
  assert.equal(event.normalized_payload.ip, '192.168.43.197');
  assert.equal(event.normalized_payload.ip_address, '192.168.43.197');
  assert.equal(event.normalized_payload.action, 'nm_dhcp4_new_lease');
  assert.equal(event.normalized_payload.process_name, 'NetworkManager');
  assert.equal(event.normalized_payload.process_id, '866');
  assert.equal(event.normalized_payload.nm_level, 'info');
  assert.equal(event.normalized_payload.normalized, true);
});

test('normalizeLog handles advanced NetworkManager Wi-Fi timeout events', () => {
  const event = normalizeLog(
    'juil. 08 03:14:09 localhost NetworkManager[866]: <warn> [1783480449.6451] device (wlan0): link timed out.',
    { year: 2026 }
  );

  assert.equal(event.event_type, 'network_wifi_link_timeout');
  assert.equal(event.severity, 'medium');
  assert.equal(event.category, 'network_connectivity');
  assert.equal(event.normalized_payload.interface, 'wlan0');
  assert.equal(event.normalized_payload.action, 'nm_wifi_link_timeout');
});

test('normalizeLog handles advanced NetworkManager activation failures', () => {
  const event = normalizeLog(
    "juil. 08 03:14:09 localhost NetworkManager[866]: <warn> [1783480449.6451] device (wlan0): Activation: failed for connection 'Anonymous '",
    { year: 2026 }
  );

  assert.equal(event.event_type, 'network_connection_activation_failed');
  assert.equal(event.severity, 'medium');
  assert.equal(event.category, 'network_connectivity');
  assert.equal(event.normalized_payload.interface, 'wlan0');
  assert.equal(event.normalized_payload.connection_name, 'Anonymous ');
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

test('normalizeLog handles pc_usage daily time reports without generic fallback', () => {
  const event = normalizeLog(
    "juil. 10 00:02:00 localhost pc_usage.sh[2292]: [2026-07-10] Temps PC aujourd'hui : 0h 2min",
    { year: 2026 }
  );

  assert.equal(event.service, 'pc_usage.sh');
  assert.equal(event.event_type, 'pc_usage_daily_time_reported');
  assert.equal(event.title, 'Temps d’utilisation PC mis à jour');
  assert.equal(event.category, 'user_activity');
  assert.equal(event.interpretation_rule_id, 'pc_usage_daily_time_reported');
  assert.notEqual(event.interpretation_rule_id, 'fallback_generic');
  assert.notEqual(event.title, 'Événement système détecté');
  assert.equal(event.normalized_payload.usage_date, '2026-07-10');
  assert.equal(event.normalized_payload.usage_hours, 0);
  assert.equal(event.normalized_payload.usage_minutes, 2);
  assert.equal(event.normalized_payload.usage_total_minutes, 2);
});

test('normalizeLog handles Realtek kernel LPS firmware failures', () => {
  const event = normalizeLog(
    'juil. 10 00:02:00 localhost kernel: rtw88_8822be 0000:02:00.0: firmware failed to leave lps state',
    { year: 2026 }
  );

  assert.equal(event.event_type, 'wifi_driver_firmware_lps_exit_failed');
  assert.equal(event.severity, 'medium');
  assert.equal(event.category, 'hardware_driver');
  assert.equal(event.interpretation_rule_id, 'kernel_rtw88_firmware_lps_exit_failed');
  assert.equal(event.normalized_payload.driver, 'rtw88_8822be');
  assert.equal(event.normalized_payload.pci_address, '0000:02:00.0');
  assert.notEqual(event.interpretation_rule_id, 'fallback_generic');
  assert.notEqual(event.title, 'Événement système détecté');
});

test('normalizeLog handles systemd app scope resource usage', () => {
  const event = normalizeLog(
    'juil. 10 00:02:00 localhost systemd[1]: app-com.google.Chrome-359362.scope: Consumed 15.809s CPU time over 10min 15.952s wall clock time, 181.1M memory peak.',
    { year: 2026 }
  );

  assert.equal(event.event_type, 'systemd_app_scope_resource_usage_reported');
  assert.equal(event.category, 'resource_usage');
  assert.equal(event.interpretation_rule_id, 'systemd_app_scope_resource_usage');
  assert.equal(event.normalized_payload.systemd_scope, 'app-com.google.Chrome-359362.scope');
  assert.equal(event.normalized_payload.application_name, 'com.google.Chrome');
  assert.equal(event.normalized_payload.cpu_seconds, 15.809);
  assert.equal(event.normalized_payload.wall_clock_total_seconds, 615.952);
  assert.equal(event.normalized_payload.memory_peak_value, 181.1);
  assert.equal(event.normalized_payload.memory_peak_unit, 'M');
  assert.notEqual(event.interpretation_rule_id, 'fallback_generic');
  assert.notEqual(event.title, 'Événement système détecté');
});

test('normalizeLog handles sudo command invocations', () => {
  const event = normalizeLog(
    'juil. 10 00:02:00 localhost sudo: dodo : TTY=pts/2 ; PWD=/home/dodo/log ; USER=root ; COMMAND=/usr/bin/journalctl -f',
    { year: 2026 }
  );

  assert.equal(event.event_type, 'sudo_command_invoked');
  assert.equal(event.category, 'privilege_escalation');
  assert.equal(event.severity, 'medium');
  assert.equal(event.interpretation_rule_id, 'sudo_command_invoked');
  assert.equal(event.normalized_payload.username, 'dodo');
  assert.equal(event.normalized_payload.tty, 'pts/2');
  assert.equal(event.normalized_payload.working_directory, '/home/dodo/log');
  assert.equal(event.normalized_payload.target_user, 'root');
  assert.equal(event.normalized_payload.command, '/usr/bin/journalctl -f');
  assert.equal(event.normalized_payload.is_privilege_escalation, true);
  assert.notEqual(event.interpretation_rule_id, 'fallback_generic');
  assert.notEqual(event.title, 'Événement système détecté');
});

test('normalizeLog handles sudo PAM session opened separately from commands', () => {
  const event = normalizeLog(
    'juil. 10 00:02:00 localhost sudo: pam_unix(sudo:session): session opened for user root(uid=0) by dodo(uid=1000)',
    { year: 2026 }
  );

  assert.equal(event.event_type, 'sudo_pam_session_opened');
  assert.equal(event.category, 'privilege_escalation');
  assert.equal(event.interpretation_rule_id, 'sudo_pam_session_opened');
  assert.notEqual(event.event_type, 'sudo_command_invoked');
  assert.equal(event.normalized_payload.actor_user, 'dodo');
  assert.equal(event.normalized_payload.actor_uid, '1000');
  assert.equal(event.normalized_payload.target_user, 'root');
  assert.equal(event.normalized_payload.target_uid, '0');
  assert.equal(event.normalized_payload.is_root_session, true);
});

test('normalizeLog handles CRON PAM session opened', () => {
  const event = normalizeLog(
    'juil. 10 00:02:00 localhost CRON[1234]: pam_unix(cron:session): session opened for user root(uid=0) by root(uid=0)',
    { year: 2026 }
  );

  assert.equal(event.event_type, 'cron_pam_session_opened');
  assert.equal(event.category, 'scheduled_task');
  assert.equal(event.interpretation_rule_id, 'cron_pam_session_opened');
  assert.notEqual(event.event_type, 'cron_command_executed');
  assert.equal(event.normalized_payload.actor_user, 'root');
  assert.equal(event.normalized_payload.target_user, 'root');
  assert.equal(event.normalized_payload.session_action, 'opened');
});

test('normalizeLog handles CRON PAM session closed', () => {
  const event = normalizeLog(
    'juil. 10 00:02:00 localhost CRON[1234]: pam_unix(cron:session): session closed for user root',
    { year: 2026 }
  );

  assert.equal(event.event_type, 'cron_pam_session_closed');
  assert.equal(event.category, 'scheduled_task');
  assert.equal(event.interpretation_rule_id, 'cron_pam_session_closed');
  assert.notEqual(event.event_type, 'cron_command_executed');
  assert.equal(event.normalized_payload.target_user, 'root');
  assert.equal(event.normalized_payload.session_action, 'closed');
});

test('normalizeLog handles CRON command execution', () => {
  const event = normalizeLog(
    'juil. 10 00:02:00 localhost CRON[1234]: (root) CMD (command -v debian-sa1 > /dev/null && debian-sa1 1 1)',
    { year: 2026 }
  );

  assert.equal(event.event_type, 'cron_command_executed');
  assert.equal(event.category, 'scheduled_task');
  assert.equal(event.interpretation_rule_id, 'cron_command_executed');
  assert.equal(event.normalized_payload.username, 'root');
  assert.equal(event.normalized_payload.command, 'command -v debian-sa1 > /dev/null && debian-sa1 1 1');
  assert.equal(event.normalized_payload.is_root_job, true);
  assert.notEqual(event.interpretation_rule_id, 'fallback_generic');
  assert.notEqual(event.title, 'Événement système détecté');
});

test('normalizeLog displays raw message when no precise normalizer matches', () => {
  const event = normalizeLog(
    'déc. 31 23:59:59 localhost custom-process[42]: something happened',
    { year: 2026 }
  );

  assert.equal(event.event_type, 'system_event_unknown');
  assert.equal(event.severity, 'low');
  assert.equal(event.category, 'system');
  assert.equal(event.title, 'something happened');
  assert.equal(event.description, 'something happened');
  assert.equal(event.interpretation_confidence, 0.2);
  assert.equal(event.interpretation_rule_id, 'unknown_fingerprint');
  assert.equal(event.message, 'something happened');
  assert.equal(event.normalized_payload.normalized, false);
  assert.equal(event.normalized_payload.needs_rule, true);
});
