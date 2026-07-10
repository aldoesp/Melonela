const { parseGenericJournalctl } = require('./parsers/genericJournalctlParser');
const { parseNetworkManagerLog } = require('./parsers/networkManagerParser');
const { parsePcUsageLog } = require('./parsers/pcUsageParser');
const { parseSshdLog } = require('./parsers/sshdParser');
const { parseSudoLog } = require('./parsers/sudoParser');
const { parseSystemdLog } = require('./parsers/systemdParser');

function includesSource(rawLog, needle) {
  const haystack = [
    rawLog._COMM,
    rawLog.SYSLOG_IDENTIFIER,
    rawLog._SYSTEMD_UNIT,
    rawLog.MESSAGE,
  ].filter(Boolean).join(' ').toLowerCase();

  return haystack.includes(needle);
}

// Choisit le parser le plus adapté au service journalctl détecté.
function parseJournalctlLog(rawLog) {
  if (includesSource(rawLog, 'sudo')) return parseSudoLog(rawLog);
  if (includesSource(rawLog, 'sshd')) return parseSshdLog(rawLog);
  if (includesSource(rawLog, 'systemd')) return parseSystemdLog(rawLog);
  if (includesSource(rawLog, 'networkmanager')) return parseNetworkManagerLog(rawLog);
  if (includesSource(rawLog, 'pc_usage.sh')) return parsePcUsageLog(rawLog);

  return parseGenericJournalctl(rawLog);
}

module.exports = {
  parseJournalctlLog,
};
