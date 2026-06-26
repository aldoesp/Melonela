const { parseGenericJournalctl } = require('./genericJournalctlParser');

function parseSshdLog(rawLog) {
  const message = String(rawLog.MESSAGE || '');
  const failed = message.includes('Failed password');
  const userMatch = message.match(/Failed password for (?:invalid user )?(?<username>\S+)/);

  return parseGenericJournalctl(rawLog, {
    service: 'sshd',
    event_type: failed ? 'ssh_failed' : 'ssh_event',
    severity: failed ? 'high' : undefined,
    username: userMatch?.groups?.username || null,
    normalized_payload: {
      username: userMatch?.groups?.username || null,
    },
  });
}

module.exports = {
  parseSshdLog,
};
