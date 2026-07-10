const assert = require('node:assert/strict');
const test = require('node:test');

const eventInterpretationEngine = require('../services/eventInterpretationEngine');
const { parseJournalctlLog } = require('../services/parserFactory');
const { normalizeLog } = require('../src/logs/normalizeLog');

test('journalctl JSON pc_usage daily time report avoids generic fallback', () => {
  const rawLog = {
    __REALTIME_TIMESTAMP: '1783639624443000',
    _HOSTNAME: 'localhost',
    _COMM: 'pc_usage.sh',
    SYSLOG_IDENTIFIER: 'pc_usage.sh',
    _PID: '2292',
    _SYSTEMD_UNIT: 'user@1000.service',
    _TRANSPORT: 'stdout',
    _UID: '1000',
    _GID: '1000',
    PRIORITY: '6',
    MESSAGE: "[2026-07-09] Temps PC aujourd'hui : 8h 3min",
  };

  const parsed = parseJournalctlLog(rawLog);
  const interpreted = eventInterpretationEngine.interpret(parsed);

  assert.equal(interpreted.source_name, 'journalctl');
  assert.equal(interpreted.source_type, 'system');
  assert.equal(interpreted.service, 'pc_usage.sh');
  assert.equal(interpreted.process_name, 'pc_usage.sh');
  assert.equal(interpreted.process_id, '2292');
  assert.equal(interpreted.message, "[2026-07-09] Temps PC aujourd'hui : 8h 3min");
  assert.equal(interpreted.event_type, 'pc_usage_daily_time_reported');
  assert.equal(interpreted.title, 'Temps d’utilisation PC mis à jour');
  assert.equal(
    interpreted.description,
    'Le suivi d’utilisation indique 8h 3min de temps PC pour la journée du 2026-07-09.'
  );
  assert.equal(interpreted.category, 'user_activity');
  assert.equal(interpreted.severity, 'low');
  assert.equal(interpreted.human_severity, 'low');
  assert.equal(interpreted.interpretation_rule_id, 'pc_usage_daily_time_reported');
  assert.equal(interpreted.interpretation_confidence, 0.96);
  assert.notEqual(interpreted.interpretation_rule_id, 'fallback_generic');
  assert.notEqual(interpreted.title, 'Événement système détecté');
  assert.equal(interpreted.normalized_payload.usage_date, '2026-07-09');
  assert.equal(interpreted.normalized_payload.usage_hours, 8);
  assert.equal(interpreted.normalized_payload.usage_minutes, 3);
  assert.equal(interpreted.normalized_payload.usage_total_minutes, 483);
  assert.equal(interpreted.normalized_payload.tracker_name, 'pc_usage.sh');
  assert.equal(interpreted.normalized_payload.action, 'pc_usage_daily_time_reported');
  assert.equal(interpreted.normalized_payload.normalized, true);
  assert.equal(interpreted.normalized_payload.needs_rule, false);
});

test('normalizeLog handles pc_usage daily time report', () => {
  const event = normalizeLog(
    "juil. 09 23:27:04 localhost pc_usage.sh[2292]: [2026-07-09] Temps PC aujourd'hui : 8h 3min",
    { year: 2026 }
  );

  assert.equal(event.service, 'pc_usage.sh');
  assert.equal(event.event_type, 'pc_usage_daily_time_reported');
  assert.equal(event.interpretation_rule_id, 'pc_usage_daily_time_reported');
  assert.equal(event.interpretation_confidence, 0.96);
  assert.notEqual(event.interpretation_rule_id, 'fallback_generic');
  assert.notEqual(event.title, 'Événement système détecté');
  assert.equal(event.normalized_payload.usage_date, '2026-07-09');
  assert.equal(event.normalized_payload.usage_total_minutes, 483);
});
