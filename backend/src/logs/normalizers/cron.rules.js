const CRON_RULES = [
  {
    id: 'cron_pam_session_opened',
    pattern: /^pam_unix\(cron:session\):\s+session opened for user (?<target_user>[^\s(]+)\(uid=(?<target_uid>\d+)\) by (?<actor_user>[^\s(]+)\(uid=(?<actor_uid>\d+)\)$/i,
    event_type: 'cron_pam_session_opened',
    category: 'scheduled_task',
    severity: 'low',
    icon: 'clock',
    title: 'Session CRON ouverte',
    interpretation_confidence: 0.96,
    buildDescription: ({ target_user, target_uid, actor_user, actor_uid }) => (
      `CRON a ouvert une session système pour ${target_user}(uid=${target_uid}), initiée par ${actor_user}(uid=${actor_uid}).`
    ),
    buildFields: ({ target_user, target_uid, actor_user, actor_uid }) => ({
      pam_module: 'pam_unix',
      pam_service: 'cron',
      session_action: 'opened',
      username: target_user,
      target_user,
      target_uid,
      actor_user,
      actor_uid,
      is_root_session: target_user === 'root' || target_uid === '0',
      is_privileged: target_user === 'root' || target_uid === '0',
    }),
  },
  {
    id: 'cron_pam_session_closed',
    pattern: /^pam_unix\(cron:session\):\s+session closed for user (?<target_user>[^\s(]+)$/i,
    event_type: 'cron_pam_session_closed',
    category: 'scheduled_task',
    severity: 'low',
    icon: 'clock',
    title: 'Session CRON fermée',
    interpretation_confidence: 0.95,
    buildDescription: ({ target_user }) => (
      `CRON a fermé une session système ouverte pour ${target_user}.`
    ),
    buildFields: ({ target_user }) => ({
      pam_module: 'pam_unix',
      pam_service: 'cron',
      session_action: 'closed',
      username: target_user,
      target_user,
      is_root_session: target_user === 'root',
      is_privileged: target_user === 'root',
    }),
  },
  {
    id: 'cron_command_executed',
    pattern: /^\((?<cron_user>[^)]+)\)\s+CMD\s+\((?<command>.*)\)$/i,
    event_type: 'cron_command_executed',
    category: 'scheduled_task',
    severity: 'low',
    icon: 'terminal',
    title: 'Commande CRON exécutée',
    interpretation_confidence: 0.97,
    buildDescription: ({ cron_user, command }) => (
      `CRON a lancé une commande planifiée en tant que ${cron_user}. Commande : ${command}.`
    ),
    buildFields: ({ cron_user, command }) => ({
      username: cron_user,
      target_user: cron_user,
      command: command.trim(),
      scheduler: 'cron',
      is_root_job: cron_user === 'root',
    }),
  },
];

module.exports = {
  CRON_RULES,
};
