const SUDO_RULES = [
  {
    id: 'sudo_command_invoked',
    pattern: /^\s*(?<username>\S+)\s+:\s+TTY=(?<tty>[^;]+)\s*;\s*PWD=(?<working_directory>[^;]+)\s*;\s*USER=(?<target_user>[^;]+)\s*;\s*COMMAND=(?<command>.+)$/i,
    event_type: 'sudo_command_invoked',
    category: 'privilege_escalation',
    severity: 'medium',
    icon: 'shield',
    title: 'Commande sudo invoquée',
    interpretation_confidence: 0.97,
    buildDescription: ({ username, target_user, command, working_directory, tty }) => (
      `${username} a invoqué sudo pour exécuter une commande en tant que ${target_user.trim()} depuis ${working_directory.trim()} sur ${tty.trim()}. Commande : ${command.trim()}.`
    ),
    buildFields: ({ username, tty, working_directory, target_user, command }) => ({
      username,
      tty: tty.trim(),
      working_directory: working_directory.trim(),
      target_user: target_user.trim(),
      command: command.trim(),
      is_privilege_escalation: target_user.trim() === 'root',
      auth_context: 'sudo',
    }),
  },
  {
    id: 'sudo_pam_session_opened',
    pattern: /^pam_unix\(sudo:session\):\s+session opened for user (?<target_user>[^\s(]+)\(uid=(?<target_uid>\d+)\) by (?<actor_user>[^\s(]+)\(uid=(?<actor_uid>\d+)\)$/i,
    event_type: 'sudo_pam_session_opened',
    category: 'privilege_escalation',
    severity: 'medium',
    icon: 'shield',
    title: 'Session sudo ouverte',
    interpretation_confidence: 0.96,
    buildDescription: ({ target_user, target_uid, actor_user, actor_uid }) => (
      `Une session PAM sudo a été ouverte pour ${target_user}(uid=${target_uid}) par ${actor_user}(uid=${actor_uid}).`
    ),
    buildFields: ({ target_user, target_uid, actor_user, actor_uid }) => ({
      pam_module: 'pam_unix',
      pam_service: 'sudo',
      session_action: 'opened',
      username: actor_user,
      actor_user,
      actor_uid,
      target_user,
      target_uid,
      is_root_session: target_user === 'root' || target_uid === '0',
      is_privileged: target_user === 'root' || target_uid === '0',
    }),
  },
];

module.exports = {
  SUDO_RULES,
};
