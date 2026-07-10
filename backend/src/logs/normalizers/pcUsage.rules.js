const PC_USAGE_RULES = [
  {
    id: 'pc_usage_daily_time_reported',
    pattern: /^\[(?<usage_date>\d{4}-\d{2}-\d{2})\]\s+Temps PC aujourd'hui\s+:\s+(?<hours>\d+)h\s+(?<minutes>\d+)min$/i,
    event_type: 'pc_usage_daily_time_reported',
    category: 'user_activity',
    severity: 'low',
    icon: 'monitor',
    title: 'Temps d’utilisation PC mis à jour',
    buildDescription: ({ usage_date, hours, minutes }) => (
      `Le suivi d’utilisation indique ${hours}h ${minutes}min de temps PC pour la journée du ${usage_date}.`
    ),
    buildFields: ({ usage_date, hours, minutes }) => ({
      usage_date,
      usage_hours: Number(hours),
      usage_minutes: Number(minutes),
      usage_total_minutes: (Number(hours) * 60) + Number(minutes),
      tracker_name: 'pc_usage.sh',
    }),
    interpretation_confidence: 0.96,
  },
];

module.exports = {
  PC_USAGE_RULES,
};
