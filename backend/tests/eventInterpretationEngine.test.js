const assert = require('node:assert/strict');
const test = require('node:test');

const eventInterpretationEngine = require('../services/eventInterpretationEngine');
const { parseJournalctlLog } = require('../services/parserFactory');

test('journalctl JSON fallback uses the raw message as the UI title', () => {
  const rawLog = {
    __REALTIME_TIMESTAMP: '1783480449645100',
    _HOSTNAME: 'localhost',
    _COMM: 'custom-process',
    SYSLOG_IDENTIFIER: 'custom-process',
    _PID: '42',
    MESSAGE: 'something happened without a precise normalizer',
  };

  const parsed = parseJournalctlLog(rawLog);
  const interpreted = eventInterpretationEngine.interpret(parsed);

  assert.equal(interpreted.service, 'custom-process');
  assert.equal(interpreted.message, 'something happened without a precise normalizer');
  assert.equal(interpreted.title, 'something happened without a precise normalizer');
  assert.equal(interpreted.description, 'something happened without a precise normalizer');
  assert.equal(interpreted.interpretation_rule_id, 'fallback_generic');
});
