function toNumber(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeSystemdScopeName(scope) {
  if (!scope) return null;

  return scope
    .replace(/^app-/, '')
    .replace(/-\d+\.scope$/, '')
    .replace(/\.scope$/, '')
    .replace(/-/g, '.');
}

const SYSTEMD_RULES = [
  {
    id: 'systemd_app_scope_resource_usage',
    pattern: /^(?<scope>[^:]+\.scope):\s+Consumed\s+(?<cpu_seconds>[\d.]+)s\s+CPU time over\s+(?<wall_minutes>\d+)min\s+(?<wall_seconds>[\d.]+)s\s+wall clock time,\s+(?<memory_peak>[\d.]+)(?<memory_unit>[KMGT]?)\s+memory peak\.$/i,
    event_type: 'systemd_app_scope_resource_usage_reported',
    category: 'resource_usage',
    severity: 'low',
    icon: 'activity',
    title: 'Consommation de ressources d’application',
    interpretation_confidence: 0.93,
    buildDescription: ({ scope, cpu_seconds, wall_minutes, wall_seconds, memory_peak, memory_unit }) => {
      const appName = normalizeSystemdScopeName(scope) || scope;
      return `systemd indique que ${appName} a consommé ${cpu_seconds}s de CPU sur ${wall_minutes}min ${wall_seconds}s, avec un pic mémoire de ${memory_peak}${memory_unit}.`;
    },
    buildFields: ({ scope, cpu_seconds, wall_minutes, wall_seconds, memory_peak, memory_unit }) => ({
      systemd_scope: scope,
      application_name: normalizeSystemdScopeName(scope),
      cpu_seconds: toNumber(cpu_seconds),
      wall_clock_minutes: toNumber(wall_minutes),
      wall_clock_seconds: toNumber(wall_seconds),
      wall_clock_total_seconds: (toNumber(wall_minutes, 0) * 60) + toNumber(wall_seconds, 0),
      memory_peak_value: toNumber(memory_peak),
      memory_peak_unit: memory_unit || null,
    }),
  },
];

module.exports = {
  SYSTEMD_RULES,
};
