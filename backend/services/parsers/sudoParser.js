const { parseGenericJournalctl } = require('./genericJournalctlParser');
const { maskSensitiveText } = require('../sensitiveMaskingService');

const SUDO_COMMAND_REGEX = /^\s*(?<username>[^:]+)\s*:\s*TTY=(?<tty>[^;]+)\s*;\s*PWD=(?<pwd>[^;]+)\s*;\s*USER=(?<targetUser>[^;]+)\s*;\s*COMMAND=(?<command>.+)$/;

function parseSudoLog(rawLog) {
  const message = String(rawLog.MESSAGE || '');
  const match = message.match(SUDO_COMMAND_REGEX);

  if (!match?.groups) {
    return parseGenericJournalctl(rawLog, {
      service: 'sudo',
      event_type: message.includes('session opened') ? 'sudo_session_opened' : 'sudo_event',
      severity: 'low',
    });
  }

  const username = match.groups.username.trim();
  const tty = match.groups.tty.trim();
  const workingDirectory = match.groups.pwd.trim();
  const targetUser = match.groups.targetUser.trim();
  const command = maskSensitiveText(match.groups.command.trim());

  return parseGenericJournalctl(rawLog, {
    service: 'sudo',
    event_type: 'sudo_command',
    severity: 'low',
    username,
    tty,
    working_directory: workingDirectory,
    target_user: targetUser,
    command,
    message: `${username} executed sudo command: ${command}`,
    normalized_payload: {
      username,
      tty,
      working_directory: workingDirectory,
      target_user: targetUser,
      command,
    },
  });
}

module.exports = {
  parseSudoLog,
};
