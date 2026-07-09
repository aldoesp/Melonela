const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildJournalctlFollowArgs,
  formatJournalctlSince,
} = require('../services/journalctlRealtimeService');

test('formatJournalctlSince converts a DB timestamp to a journalctl --since value', () => {
  assert.equal(
    formatJournalctlSince('2026-06-26T23:33:56.823Z'),
    '2026-06-26 23:33:56.824 UTC'
  );
});

test('buildJournalctlFollowArgs prefers journal cursor when available', () => {
  assert.deepEqual(
    buildJournalctlFollowArgs({
      journalCursor: 's=abc;i=123',
      eventTimestamp: '2026-06-26T23:33:56.823Z',
    }),
    ['--after-cursor', 's=abc;i=123', '-f', '-o', 'json']
  );
});

test('buildJournalctlFollowArgs falls back to --since when only timestamp is available', () => {
  assert.deepEqual(
    buildJournalctlFollowArgs({
      eventTimestamp: '2026-06-26T23:33:56.823Z',
    }),
    ['--since', '2026-06-26 23:33:56.824 UTC', '-f', '-o', 'json']
  );
});

test('buildJournalctlFollowArgs follows current logs when no sync position exists', () => {
  const original = process.env.JOURNALCTL_INITIAL_SYNC_SINCE;
  delete process.env.JOURNALCTL_INITIAL_SYNC_SINCE;

  try {
    assert.deepEqual(buildJournalctlFollowArgs(), ['-f', '-o', 'json']);
  } finally {
    if (original !== undefined) process.env.JOURNALCTL_INITIAL_SYNC_SINCE = original;
  }
});
