import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  LayoutDashboard, Activity, BarChart2, FileText, Settings,
  Search, Bell, Shield, ChevronDown, ChevronRight, Play, Pause,
  Download, TrendingUp, TrendingDown, Server, AlertTriangle,
  XCircle, LogOut, Trash2, Filter, Terminal, Hash,
  BrainCircuit,
  FileDown, FileCog, CalendarDays, CheckSquare, Square,
  Clock, HardDrive, CheckCircle2, Loader2, XCircle as XCircleIcon,
  ChevronUp, Trash, Copy, RotateCw, KeyRound, Cloud, MonitorCog,
  UserCog, History, ShieldCheck, Save,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import {
  deleteUser,
  getExportUrl,
  getCurrentUser,
  getMyUserActions,
  getProfile,
  getUsers,
  trackUserAction,
  updatePassword,
  updateProfile,
  updateUser,
} from "../api/authApi";
import type { UserActionLog, UserProfile } from "../api/authApi";
import {
  connectAuditLogSocket,
  filterAuditLogs,
  getAuditLogs,
  getJournalctlLiveStatus,
  searchAuditLogs,
  startJournalctlLive,
  stopJournalctlLive,
  type AuditLog,
  type AuditLogPagination,
  type AuditLogQuery,
  type JournalctlLiveStatus,
} from "../services/auditLogs";

// ── Types ──────────────────────────────────────────────────────────────────────

type Severity = "CRITIQUE" | "AVERTISSEMENT" | "INFO";
type NavId = "dashboard" | "live" | "rapports" | "parametres" | "profil" | "sessions" | "ssh" | "administration";

// ── Palette ────────────────────────────────────────────────────────────────────

const C = { info: "#10b981", warn: "#f59e0b", crit: "#ef4444" };

const SEV: Record<Severity, { pill: string; text: string; dot: string }> = {
  CRITIQUE:      { pill: "bg-red-500/15 text-red-400",         text: "text-red-400",     dot: "bg-red-500"     },
  AVERTISSEMENT: { pill: "bg-amber-500/15 text-amber-400",     text: "text-amber-400",   dot: "bg-amber-500"   },
  INFO:          { pill: "bg-emerald-500/15 text-emerald-400", text: "text-emerald-400", dot: "bg-emerald-400" },
};

const NAV_ITEMS: { id: NavId; icon: React.ElementType; label: string }[] = [
  { id: "dashboard",  icon: LayoutDashboard, label: "Security Overview" },
  { id: "live",       icon: Activity,        label: "Event Stream"      },
  { id: "rapports",   icon: FileText,        label: "Reports"           },
  { id: "sessions",   icon: History,         label: "User Audit"        },
  { id: "administration", icon: UserCog,     label: "Administration"    },
  { id: "parametres", icon: Settings,        label: "Control Plane"     },
];

const NAV_LABELS: Record<NavId, string> = {
  dashboard: "Security Overview",
  live: "Event Stream",
  rapports: "Rapports",
  parametres: "Paramètres",
  profil: "Mon Profil",
  sessions: "User Audit",
  ssh: "Sécurité & Clés SSH",
  administration: "Administration",
};

const EVENT_LABELS: Record<string, string> = {
  ssh_failed: "Échec SSH",
  service_started: "Service démarré",
  service_stopped: "Service arrêté",
  system_error: "Erreur système",
  system_event: "Événement système",
};

const EVENT_TYPES = Object.entries(EVENT_LABELS).map(([value, label]) => ({ value, label }));

const USER_ACTION_LABELS: Record<string, string> = {
  LOGIN_SUCCESS: "Connexion réussie",
  USER_REGISTERED: "Création du compte",
  LOGOUT: "Déconnexion",
  NAVIGATE: "Navigation",
  VIEW_ACTION_JOURNAL: "Consultation du journal",
  GENERATE_REPORT: "Génération de rapport",
  EXPORT_REPORT: "Export de rapport",
  REPORT_EXPORTED: "Export de rapport",
  REPORT_DOWNLOADED: "Téléchargement de rapport",
  CLEAR_LIVE_FEED: "Flux live vidé",
  UPDATE_SETTINGS: "Paramètre modifié",
  SETTINGS_UPDATED: "Paramètre modifié",
  PROFILE_UPDATE: "Profil modifié",
  PROFILE_UPDATED: "Profil modifié",
  SSH_KEY_ACTION: "Action clé SSH",
  PASSWORD_CHANGED: "Mot de passe modifié",
  SSH_KEY_ADDED: "Clé SSH ajoutée",
  SSH_KEY_DELETED: "Clé SSH supprimée",
  USER_UPDATED: "Utilisateur modifié",
  USER_DELETED: "Utilisateur désactivé",
  ROLE_UPDATED: "Rôle modifié",
  ADMIN_SECTION_VIEWED: "Administration consultée",
  JOURNALCTL_COLLECTED: "Collecte journalctl",
};

function eventLabel(eventType: string) {
  return EVENT_LABELS[eventType] ?? eventType.replaceAll("_", " ");
}

function severityForLog(log: AuditLog): Severity {
  if (log.humanSeverity === "critical" || log.humanSeverity === "high") return "CRITIQUE";
  if (log.humanSeverity === "medium") return "AVERTISSEMENT";
  if (log.severity === "critical" || log.severity === "high") return "CRITIQUE";
  if (log.severity === "medium") return "AVERTISSEMENT";
  return "INFO";
}

function displayTitle(log: AuditLog) {
  return log.title || eventLabel(log.eventType);
}

function displayDescription(log: AuditLog) {
  return log.description || log.message;
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function isAdminRole(role?: string | null) {
  return role === "admin" || role === "super_admin";
}

function buildHourlyData(logs: AuditLog[]) {
  const hours = Array.from({ length: 24 }, (_, hour) => ({
    h: `${String(hour).padStart(2, "0")}h`,
    i: 0,
    a: 0,
    c: 0,
  }));

  logs.forEach((log) => {
    const hour = new Date(log.eventTimestamp).getHours();
    const severity = severityForLog(log);
    if (severity === "CRITIQUE") hours[hour].c += 1;
    else if (severity === "AVERTISSEMENT") hours[hour].a += 1;
    else hours[hour].i += 1;
  });

  return hours;
}

function buildSeverityData(logs: AuditLog[]) {
  const counts: Record<Severity, number> = { INFO: 0, AVERTISSEMENT: 0, CRITIQUE: 0 };
  logs.forEach((log) => {
    counts[severityForLog(log)] += 1;
  });

  return [
    { name: "Info", value: counts.INFO, color: C.info },
    { name: "Avertissement", value: counts.AVERTISSEMENT, color: C.warn },
    { name: "Critique", value: counts.CRITIQUE, color: C.crit },
  ];
}

// ── JSON syntax highlighter ────────────────────────────────────────────────────

function JsonBlock({ data }: { data: Record<string, unknown> }) {
  const html = JSON.stringify(data, null, 2).replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g,
    (m) => {
      if (/^"/.test(m) && /:$/.test(m)) return `<span style="color:#93c5fd">${m}</span>`;
      if (/^"/.test(m))                  return `<span style="color:#86efac">${m}</span>`;
      if (/true|false/.test(m))          return `<span style="color:#f9a8d4">${m}</span>`;
      if (/null/.test(m))                return `<span style="color:#a78bfa">${m}</span>`;
      return `<span style="color:#fcd34d">${m}</span>`;
    }
  );
  return (
    <pre
      className="text-[11px] font-mono leading-relaxed bg-black/70 rounded-lg p-4 overflow-x-auto"
      style={{ scrollbarWidth: "none" } as React.CSSProperties}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

// ── Shared atoms ───────────────────────────────────────────────────────────────

function Badge({ level }: { level: Severity }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-semibold tracking-wider ${SEV[level].pill}`}>
      {level}
    </span>
  );
}

function KpiCard({ title, value, icon: Icon, bg, vc, sub, trend }: {
  title: string; value: string; icon: React.ElementType;
  bg: string; vc?: string; sub?: string; trend?: "up" | "down";
}) {
  return (
    <div className="bg-card border border-border rounded-lg p-5 flex flex-col gap-3 hover:border-zinc-600 transition-colors">
      <div className="flex items-start justify-between">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${bg}`}>
          <Icon size={17} className="text-white" />
        </div>
        {trend && (
          <span className={`flex items-center gap-0.5 text-[11px] font-mono ${trend === "up" ? "text-emerald-400" : "text-red-400"}`}>
            {trend === "up" ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            {trend === "up" ? "+2.4%" : "-1.1%"}
          </span>
        )}
      </div>
      <div>
        <p className={`text-2xl font-bold tracking-tight ${vc ?? "text-foreground"}`}>{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{title}</p>
        {sub && <p className="text-[11px] text-zinc-600 mt-1">{sub}</p>}
      </div>
    </div>
  );
}

function ChartTip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-xs font-mono shadow-xl">
      <p className="text-zinc-400 mb-1.5">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-zinc-300">{p.name}:</span>
          <span className="text-white font-semibold">{p.value.toLocaleString("fr-FR")}</span>
        </div>
      ))}
    </div>
  );
}

// ── Shell (sidebar + header) ───────────────────────────────────────────────────

function Shell({
  active,
  onNav,
  onLogout,
  canUseAdmin,
  children,
}: {
  active: NavId;
  onNav: (id: NavId) => void;
  onLogout: () => void;
  canUseAdmin: boolean;
  children: React.ReactNode;
}) {
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const currentUser = getCurrentUser();
  const username = currentUser?.username ?? "Utilisateur";
  const role = currentUser?.role ?? "auditor";
  const initials = username
    .split(/[.\s_-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "U";
  const date = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const navItems = NAV_ITEMS.filter((item) => item.id !== "administration" || canUseAdmin);

  const profileItems: { label: string; icon: React.ElementType; nav?: NavId }[] = [
    { label: "Mon Profil", icon: UserCog, nav: "profil" },
    { label: "Journal de mes actions", icon: History, nav: "sessions" },
    { label: "Sécurité & Clés SSH", icon: ShieldCheck, nav: "ssh" },
  ];

  return (
    <div className="h-screen w-screen flex overflow-hidden bg-background text-foreground" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* Sidebar */}
      <aside className="hidden w-64 flex-shrink-0 flex-col border-r border-cyan-300/10 bg-[#070d11] md:flex">
        <div className="flex items-center gap-3 border-b border-cyan-300/10 px-5 py-4">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-cyan-300/25 bg-cyan-300/10 shadow-[0_0_28px_rgba(57,208,200,0.08)]">
            <Shield size={16} className="text-cyan-200" />
          </div>
          <div className="min-w-0">
            <span className="block text-sm font-bold tracking-wide text-slate-50">Melonela</span>
            <span className="block text-[10px] font-mono uppercase tracking-widest text-slate-500">SOC command layer</span>
          </div>
          <span className="ml-auto rounded border border-cyan-300/20 bg-cyan-300/10 px-1.5 py-0.5 font-mono text-[9px] text-cyan-200">SIEM</span>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map(({ id, icon: Icon, label }) => {
            const on = active === id;
            return (
              <button key={id} onClick={() => onNav(id)}
                className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all duration-150 ${on ? "bg-cyan-300/10 text-cyan-100 font-medium shadow-[inset_2px_0_0_rgba(57,208,200,0.7)]" : "text-slate-500 hover:bg-white/[0.045] hover:text-slate-200"}`}>
                <Icon size={15} />
                {label}
                {on && <ChevronRight size={11} className="ml-auto text-cyan-200" />}
              </button>
            );
          })}
        </nav>
        <div className="relative border-t border-border p-4">
          {profileMenuOpen && (
            <div className="absolute bottom-[76px] left-3 z-50 w-[260px] rounded-xl border border-zinc-700/70 bg-[#0c0c0e]/95 p-2 shadow-[0_24px_80px_rgba(0,0,0,0.72)] ring-1 ring-white/[0.06] backdrop-blur-xl transition duration-150">
              <div className="px-3 py-2.5">
                <p className="text-sm font-bold leading-tight text-zinc-100">{username}</p>
                <p className="mt-0.5 truncate text-[11px] font-mono text-zinc-500">
                  ID: {currentUser?.id ?? "inconnu"} ({role})
                </p>
              </div>

              <div className="my-1 h-px bg-zinc-800" />

              <div className="space-y-0.5 py-1">
                {profileItems.map(({ label, icon: Icon, nav }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => {
                      if (nav) {
                        onNav(nav);
                        setProfileMenuOpen(false);
                      }
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-xs font-medium text-zinc-400 transition hover:bg-cyan-400/[0.08] hover:text-zinc-100 hover:shadow-[inset_2px_0_0_rgba(59,130,246,0.45)]"
                  >
                    <Icon size={14} className="text-zinc-500" />
                    <span>{label}</span>
                  </button>
                ))}
              </div>

              <div className="my-1 h-px bg-zinc-800" />

              <button
                type="button"
                onClick={onLogout}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-xs font-semibold text-red-300/85 transition hover:bg-red-500/10 hover:text-red-200 hover:shadow-[inset_2px_0_0_rgba(248,113,113,0.45)]"
              >
                <LogOut size={14} className="text-red-300/75" />
                <span>Se déconnecter</span>
              </button>

              <span className="absolute -bottom-1.5 left-7 h-3 w-3 rotate-45 border-b border-r border-zinc-700/70 bg-[#0c0c0e]/95" />
            </div>
          )}

          <button
            type="button"
            onClick={() => setProfileMenuOpen((open) => !open)}
            className={`flex w-full items-center gap-3 rounded-xl p-2 text-left ring-1 ring-transparent transition ${
              profileMenuOpen ? "bg-white/[0.06] ring-white/[0.06]" : "hover:bg-white/[0.045] hover:ring-white/[0.06]"
            }`}
            aria-expanded={profileMenuOpen}
            aria-haspopup="menu"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-300 to-teal-700 flex items-center justify-center text-xs font-bold text-slate-950 flex-shrink-0">{initials}</div>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-zinc-100">{username}</p>
              <p className="truncate text-[10px] text-zinc-500">{role}</p>
            </div>
            <ChevronUp
              size={13}
              className={`ml-auto flex-shrink-0 text-zinc-600 transition-transform ${
                profileMenuOpen ? "text-zinc-300" : "rotate-180"
              }`}
            />
          </button>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex-shrink-0 flex flex-wrap items-center gap-3 border-b border-cyan-300/10 bg-[#081014] px-4 py-3 md:flex-nowrap md:gap-4 md:px-6">
          <div className="min-w-0">
            <h1 className="whitespace-nowrap text-sm font-bold text-slate-50">Security Overview</h1>
            <p className="hidden text-[10px] font-mono uppercase tracking-widest text-slate-600 sm:block">Live telemetry and operational audit</p>
          </div>
          <div className="order-3 w-full flex-1 relative md:order-none md:max-w-lg">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
            <input type="text" placeholder="Rechercher une IP, un utilisateur, un service..."
              className="w-full bg-muted border border-border rounded-lg pl-8 pr-4 py-2 text-xs placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 transition-all" />
          </div>
          <div className="ml-auto flex items-center gap-4">
            <div className="hidden items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-1.5 lg:flex">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] font-medium text-emerald-400 whitespace-nowrap">Ingestion node: online</span>
            </div>
            <button className="relative text-zinc-500 hover:text-zinc-200 transition-colors">
              <Bell size={17} />
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full text-[8px] font-bold text-white flex items-center justify-center">3</span>
            </button>
            <span className="text-[11px] text-zinc-500 font-mono capitalize whitespace-nowrap hidden xl:block">{date}</span>
            <button
              type="button"
              onClick={onLogout}
              title="Déconnexion"
              className="flex items-center gap-1.5 rounded-lg border border-zinc-800 px-2.5 py-1.5 text-[11px] font-medium text-zinc-500 transition hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-300"
            >
              <LogOut size={13} />
              <span className="hidden sm:inline">Déconnexion</span>
            </button>
          </div>
        </header>
        <nav className="flex flex-shrink-0 gap-2 overflow-x-auto border-b border-cyan-300/10 bg-[#071014] px-3 py-2 md:hidden">
          {navItems.map(({ id, icon: Icon, label }) => {
            const on = active === id;
            return (
              <button
                key={id}
                onClick={() => onNav(id)}
                className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-xs transition ${
                  on ? "bg-cyan-500/15 text-cyan-200" : "text-zinc-500"
                }`}
              >
                <Icon size={13} />
                {label}
              </button>
            );
          })}
        </nav>
        {children}
      </div>
    </div>
  );
}

// ── Dashboard view ─────────────────────────────────────────────────────────────

function DashboardView({
  logs,
  loading,
  error,
  playing,
  setPlaying,
}: {
  logs: AuditLog[];
  loading: boolean;
  error: string | null;
  playing: boolean;
  setPlaying: (v: boolean | ((p: boolean) => boolean)) => void;
}) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const areaData = useMemo(() => buildHourlyData(logs), [logs]);
  const donutData = useMemo(() => buildSeverityData(logs), [logs]);
  const total = donutData.reduce((s, d) => s + d.value, 0);
  const criticalCount = logs.filter((log) => severityForLog(log) === "CRITIQUE").length;
  const warningCount = logs.filter((log) => severityForLog(log) === "AVERTISSEMENT").length;
  const activeSources = new Set(logs.map((log) => log.sourceName)).size;

  return (
    <main className="flex-1 overflow-y-auto px-6 py-5 space-y-4" style={{ scrollbarWidth: "none" } as React.CSSProperties}>
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Événements ingérés" value={String(total)} icon={BarChart2} bg="bg-cyan-500" sub="Fenêtre active PostgreSQL" />
        <KpiCard title="Signaux High" value={String(warningCount)} icon={XCircle} bg="bg-amber-500" vc="text-amber-400" sub="Sévérité medium" />
        <KpiCard title="Critiques SOC" value={String(criticalCount)} icon={AlertTriangle} bg="bg-red-600" vc="text-red-400" sub="High ou critical" />
        <KpiCard title="Sources observées" value={String(activeSources)} icon={Server} bg="bg-slate-600" sub="Machines et services" />
      </section>

      {error && (
        <div className="rounded-lg border border-red-500/25 bg-red-500/10 px-4 py-3 text-xs font-mono text-red-300">
          {error}
        </div>
      )}

      <section className="grid grid-cols-3 gap-4">
        <div className="col-span-2 bg-card border border-border rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold">Volume des logs (24h)</h2>
            <div className="flex items-center gap-4">
              {([["Info", C.info], ["Avertissement", C.warn], ["Critique", C.crit]] as const).map(([l, col]) => (
                <span key={l} className="flex items-center gap-1.5 text-[11px] text-zinc-500">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: col }} />{l}
                </span>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={190}>
            <AreaChart data={areaData} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
              <defs>
                {([["gi", C.info], ["gw", C.warn], ["gc", C.crit]] as const).map(([id, col]) => (
                  <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={col} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={col} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis dataKey="h"  tick={{ fill: "#52525b", fontSize: 10 }} tickLine={false} axisLine={false} interval={3} />
              <YAxis              tick={{ fill: "#52525b", fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip content={<ChartTip />} />
              <Area type="monotone" dataKey="i" name="Info"          stroke={C.info} strokeWidth={1.5} fill="url(#gi)" dot={false} />
              <Area type="monotone" dataKey="a" name="Avertissement" stroke={C.warn} strokeWidth={1.5} fill="url(#gw)" dot={false} />
              <Area type="monotone" dataKey="c" name="Critique"      stroke={C.crit} strokeWidth={1.5} fill="url(#gc)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card border border-border rounded-lg p-5 flex flex-col">
          <h2 className="text-sm font-semibold mb-3">Répartition par Sévérité</h2>
          <div className="relative mx-auto h-44 w-44 flex-shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[{ name: "Total", value: total }]}
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={78}
                  dataKey="value"
                  fill="#27272a"
                  isAnimationActive={false}
                  stroke="transparent"
                />
                <Pie
                  data={donutData}
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={78}
                  paddingAngle={2}
                  dataKey="value"
                  startAngle={90}
                  endAngle={-270}
                >
                  {donutData.map((d) => (
                    <Cell key={d.name} fill={d.color} stroke="#101216" strokeWidth={2} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-base font-bold font-mono">{total.toLocaleString("fr-FR")}</span>
              <span className="text-[10px] text-zinc-600">événements</span>
            </div>
          </div>
          <div className="mt-3 space-y-2.5">
            {donutData.map((d) => (
              <div key={d.name} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-zinc-400">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />{d.name}
                </span>
                <span className="font-mono text-zinc-300">{d.value.toLocaleString("fr-FR")}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
          <div className="flex items-center gap-2">
            <Activity size={14} className="text-cyan-300" />
            <h2 className="text-sm font-semibold">Event Stream système</h2>
            {playing && <><span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse ml-2" /><span className="text-[10px] font-mono text-red-400 font-semibold">LIVE</span></>}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setPlaying((p) => !p)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${playing ? "bg-red-500/10 border-red-500/25 text-red-400 hover:bg-red-500/20" : "bg-emerald-500/10 border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/20"}`}>
              {playing ? <Pause size={11} /> : <Play size={11} />}{playing ? "Pause" : "Reprendre"}
            </button>
            <button
              onClick={() => void trackUserAction("REPORT_EXPORTED", "Dashboard audit", { source: "dashboard-summary" })}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-cyan-500/10 border border-cyan-500/25 text-cyan-300 hover:bg-cyan-500/20 transition-all"
            >
              <Download size={11} />Exporter
            </button>
          </div>
        </div>
        <div className="grid gap-2 px-5 py-2.5 border-b border-border bg-muted/40 text-[10px] font-semibold text-zinc-600 uppercase tracking-wider"
          style={{ gridTemplateColumns: "90px 155px 115px 1fr 145px 125px 32px" }}>
          <span>Heure</span><span>Service</span><span>Utilisateur</span><span>Message</span><span>Dangerosité</span><span>Commande</span><span />
        </div>
        <div className="overflow-y-auto max-h-64" style={{ scrollbarWidth: "none" } as React.CSSProperties}>
          {loading ? (
            <div className="flex h-40 flex-col items-center justify-center text-zinc-500">
              <Loader2 size={24} className="mb-2 animate-spin opacity-60" />
              <p className="text-xs font-mono">Chargement des logs PostgreSQL...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center text-zinc-500">
              <Terminal size={28} className="mb-2 opacity-20" />
              <p className="text-xs font-mono">Aucun log d'audit disponible</p>
            </div>
          ) : logs.map((log, idx) => {
            const severity = severityForLog(log);
            return (
            <div key={log.id}>
              <button onClick={() => setExpanded((p) => p === log.id ? null : log.id)}
                className={`w-full grid gap-2 px-5 py-2.5 text-left text-xs border-b border-border/40 transition-colors group ${idx % 2 === 0 ? "bg-card" : "bg-muted/10"} hover:bg-cyan-500/5`}
                style={{ gridTemplateColumns: "90px 155px 115px 1fr 145px 125px 32px" }}>
                <span className="font-mono text-zinc-500 tabular-nums text-[11px]">{formatTime(log.eventTimestamp)}</span>
                <span className="text-zinc-400 truncate font-mono text-[11px]">{log.service ?? log.eventType}</span>
                <span className="text-zinc-300 flex items-center gap-1.5 truncate"><Server size={10} className="text-zinc-600 flex-shrink-0" />{log.username ?? "-"}</span>
                <span className="min-w-0">
                  <span className="block truncate text-zinc-100">{displayTitle(log)}</span>
                  <span className="block truncate text-[10px] text-zinc-500">{displayDescription(log)}</span>
                </span>
                <span><Badge level={severity} /></span>
                <span className="font-mono text-zinc-500 text-[11px] truncate">{log.command ?? "-"}</span>
                <span className="flex items-center justify-center">
                  <ChevronDown size={13} className={`text-zinc-500 group-hover:text-zinc-400 transition-transform duration-200 ${expanded === log.id ? "rotate-180 text-cyan-300" : ""}`} />
                </span>
              </button>
              <div className="overflow-hidden transition-all duration-300" style={{ maxHeight: expanded === log.id ? "200px" : "0px" }}>
                <div className="px-5 py-3 bg-zinc-950/90 border-b border-border">
                  <JsonBlock data={{ ...log, title: displayTitle(log), description: displayDescription(log), rawMessage: log.message, eventLabel: eventLabel(log.eventType), uiSeverity: severity }} />
                </div>
              </div>
            </div>
          )})}
        </div>
        <div className="px-5 py-2 flex items-center justify-between border-t border-border bg-muted/20">
          <span className="text-xs font-mono text-zinc-500">{logs.length} entrée(s) affichée(s)</span>
          <span className="text-xs font-mono text-zinc-500">Màj: {new Date().toLocaleTimeString("fr-FR")}</span>
        </div>
      </section>
    </main>
  );
}

// ── Historique Live view ───────────────────────────────────────────────────────

const COL = "44px 104px 108px 118px 116px 170px 1fr 96px 36px";

function HistoriqueLiveView({
  logs,
  pagination,
  query,
  loading,
  error,
  playing,
  setPlaying,
  onQueryChange,
  onClear,
  onToggleJournalctlLive,
  journalctlStatus,
  journalctlBusy,
}: {
  logs: AuditLog[];
  pagination: AuditLogPagination;
  query: Required<Pick<AuditLogQuery, "page" | "limit">> & Omit<AuditLogQuery, "page" | "limit">;
  loading: boolean;
  error: string | null;
  playing: boolean;
  setPlaying: (v: boolean | ((p: boolean) => boolean)) => void;
  onQueryChange: (query: AuditLogQuery) => void;
  onClear: () => void;
  onToggleJournalctlLive: () => void;
  journalctlStatus: JournalctlLiveStatus | null;
  journalctlBusy: boolean;
}) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [blink, setBlink]           = useState(true);
  const [search, setSearch] = useState(query.search ?? "");
  const [severity, setSeverity] = useState(query.severity ?? "");
  const [humanSeverity, setHumanSeverity] = useState(query.human_severity ?? "");
  const [category, setCategory] = useState(query.category ?? "");
  const [eventType, setEventType] = useState(query.event_type ?? "");
  const [service, setService] = useState(query.service ?? "");
  const [username, setUsername] = useState(query.username ?? "");
  const [command, setCommand] = useState(query.command ?? "");
  const [dateFrom, setDateFrom] = useState(query.date_from ?? "");
  const [dateTo, setDateTo] = useState(query.date_to ?? "");
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setInterval(() => setBlink((b) => !b), 750);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (autoScroll && playing && bodyRef.current) {
      bodyRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [logs, autoScroll, playing]);

  const critN = logs.filter((l) => severityForLog(l) === "CRITIQUE").length;
  const warnN = logs.filter((l) => severityForLog(l) === "AVERTISSEMENT").length;
  const infoN = logs.filter((l) => severityForLog(l) === "INFO").length;
  const hasFilter = Boolean(query.search || query.severity || query.human_severity || query.category || query.event_type || query.service || query.username || query.command || query.date_from || query.date_to);

  const applyFilters = () => {
    onQueryChange({ search, severity, human_severity: humanSeverity, category, event_type: eventType, service, username, command, date_from: dateFrom, date_to: dateTo, page: 1 });
  };

  const resetFilters = () => {
    setSearch("");
    setSeverity("");
    setHumanSeverity("");
    setCategory("");
    setEventType("");
    setService("");
    setUsername("");
    setCommand("");
    setDateFrom("");
    setDateTo("");
    onQueryChange({ search: "", severity: "", human_severity: "", category: "", event_type: "", service: "", username: "", command: "", date_from: "", date_to: "", page: 1 });
  };

  return (
    <main className="flex-1 flex flex-col overflow-hidden px-6 py-5 gap-3">

      {/* ── Title + controls ── */}
      <div className="flex items-center gap-3 flex-wrap flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center">
            <Terminal size={14} className="text-cyan-300" />
          </div>
          <h2 className="text-lg font-semibold tracking-tight text-zinc-100">Event Stream temps réel</h2>
        </div>

        <div className="w-px h-5 bg-border flex-shrink-0" />

        {/* Play / Pause */}
        <button onClick={() => setPlaying((p) => !p)}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
            playing
              ? "bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20"
              : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"
          }`}>
          {playing ? <Pause size={12} /> : <Play size={12} />}
          {playing ? "Pause" : "Reprendre"}
        </button>

        {/* EN DIRECT pill */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600/10 border border-red-600/25">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0 transition-opacity duration-300"
            style={{ opacity: playing && blink ? 1 : 0.15 }} />
          <span className="text-[11px] font-mono font-bold text-red-400 tracking-[0.15em]">EN DIRECT</span>
        </div>

        {/* Vider */}
        <button onClick={onClear}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200 transition-all">
          <Trash2 size={12} />Nettoyer la vue
        </button>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={onToggleJournalctlLive}
            disabled={journalctlBusy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600/10 border border-emerald-600/25 text-emerald-400 hover:bg-emerald-600/20 disabled:opacity-50 transition-all"
          >
            {journalctlBusy ? <Loader2 size={12} className="animate-spin" /> : <RotateCw size={12} />}
            {journalctlStatus?.running ? "Arrêter journalctl live" : "Démarrer journalctl live"}
          </button>
          <button
            onClick={() => void trackUserAction("REPORT_EXPORTED", "Historique Live", { source: "live-feed" })}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-cyan-500/10 border border-cyan-500/25 text-cyan-300 hover:bg-cyan-500/20 transition-all"
          >
            <Download size={12} />Exporter
          </button>
        </div>
      </div>

      {/* ── Filter bar ── */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 bg-card border border-border rounded-lg flex-shrink-0">
        <Filter size={13} className="text-zinc-600 flex-shrink-0" />
        <span className="text-[11px] text-zinc-500 font-medium whitespace-nowrap">Filtres :</span>

        <div className="relative min-w-0 flex-1 max-w-[220px]">
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-muted border border-border rounded-lg px-3 py-1.5 text-xs text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500/50"
            placeholder="Recherche texte" />
        </div>

        <div className="relative min-w-0 flex-1 max-w-[150px]">
          <select value={severity} onChange={(e) => setSeverity(e.target.value)}
            className="w-full appearance-none bg-muted border border-border rounded-lg pl-3 pr-7 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-cyan-500/50 cursor-pointer">
            <option value="">Toutes sévérités</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
          <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none" />
        </div>

        <div className="relative min-w-0 flex-1 max-w-[150px]">
          <select value={humanSeverity} onChange={(e) => setHumanSeverity(e.target.value)}
            className="w-full appearance-none bg-muted border border-border rounded-lg pl-3 pr-7 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-cyan-500/50 cursor-pointer">
            <option value="">Gravité humaine</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
          <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none" />
        </div>

        <input value={category} onChange={(e) => setCategory(e.target.value)}
          className="w-28 bg-muted border border-border rounded-lg px-3 py-1.5 text-xs text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500/50"
          placeholder="Catégorie" />

        <div className="relative min-w-0 flex-1 max-w-[180px]">
          <select value={eventType} onChange={(e) => setEventType(e.target.value)}
            className="w-full appearance-none bg-muted border border-border rounded-lg pl-3 pr-7 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-cyan-500/50 cursor-pointer">
            <option value="">Tous les types</option>
            {EVENT_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
          <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none" />
        </div>

        <input value={service} onChange={(e) => setService(e.target.value)}
          className="w-28 bg-muted border border-border rounded-lg px-3 py-1.5 text-xs text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500/50"
          placeholder="Service" />

        <input value={username} onChange={(e) => setUsername(e.target.value)}
          className="w-28 bg-muted border border-border rounded-lg px-3 py-1.5 text-xs text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500/50"
          placeholder="Utilisateur" />

        <input value={command} onChange={(e) => setCommand(e.target.value)}
          className="w-36 bg-muted border border-border rounded-lg px-3 py-1.5 text-xs text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500/50"
          placeholder="Commande" />

        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
          className="bg-muted border border-border rounded-lg px-3 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-cyan-500/50 [color-scheme:dark]" />

        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
          className="bg-muted border border-border rounded-lg px-3 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-cyan-500/50 [color-scheme:dark]" />

        <button onClick={applyFilters}
          className="rounded-lg border border-cyan-500/25 bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-300 hover:bg-cyan-500/20">
          Appliquer
        </button>

        {hasFilter && (
          <button onClick={resetFilters}
            className="text-xs font-mono text-zinc-500 hover:text-zinc-400 transition-colors whitespace-nowrap">
            Réinitialiser
          </button>
        )}

        {/* Counts */}
        <div className="ml-auto flex items-center gap-2 flex-shrink-0">
          {([["CRITIQUE", critN, SEV.CRITIQUE.pill], ["AVERT.", warnN, SEV.AVERTISSEMENT.pill], ["INFO", infoN, SEV.INFO.pill]] as const).map(([l, n, cls]) => (
            <span key={l} className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${cls}`}>{n} {l}</span>
          ))}
        </div>
      </div>

      {/* ── Table card ── */}
      <div className="flex-1 bg-card border border-border rounded-lg overflow-hidden flex flex-col min-h-0">

        {/* Column headers */}
        <div className="grid gap-2 px-4 py-2.5 border-b border-border bg-[#0d0d10] text-[10px] font-semibold text-zinc-600 uppercase tracking-widest flex-shrink-0"
          style={{ gridTemplateColumns: COL }}>
          <span className="flex items-center gap-1"><Hash size={9} />ID</span>
          <span>Date</span>
          <span>Service</span>
          <span>Utilisateur</span>
          <span>PWD</span>
          <span>Commande</span>
          <span>Interprétation</span>
          <span>Cible</span>
          <span />
        </div>

        {/* Rows */}
        <div ref={bodyRef} className="overflow-y-auto flex-1 min-h-0" style={{ scrollbarWidth: "none" } as React.CSSProperties}
          onScroll={(e) => setAutoScroll(e.currentTarget.scrollTop < 50)}>

          {loading ? (
            <div className="flex flex-col items-center justify-center h-40 text-zinc-500">
              <Loader2 size={28} className="mb-2 animate-spin opacity-50" />
              <p className="text-xs font-mono">Chargement des logs PostgreSQL</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-40 text-red-400">
              <AlertTriangle size={28} className="mb-2 opacity-50" />
              <p className="text-xs font-mono">{error}</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-zinc-500">
              <Terminal size={28} className="mb-2 opacity-20" />
              <p className="text-xs font-mono">Aucun événement correspondant aux filtres</p>
            </div>
          ) : logs.map((log, idx) => {
            const isOpen = expanded === log.id;
            const isNew  = idx === 0 && playing;
            const severity = severityForLog(log);
            return (
              <div key={log.id} className={isOpen ? "border-l-2 border-cyan-400/50" : "border-l-2 border-transparent"}>

                {/* Row */}
                <button
                  onClick={() => setExpanded((p) => p === log.id ? null : log.id)}
                  className={`w-full grid gap-2 px-4 py-[8px] text-left text-xs border-b border-border/30 transition-colors duration-75 group relative
                    ${idx % 2 === 0 ? "bg-card" : "bg-[#0f0f12]"}
                    ${isOpen ? "bg-cyan-500/[0.04]" : "hover:bg-cyan-400/[0.06] hover:shadow-[inset_2px_0_0_rgba(59,130,246,0.45)]"}`}
                  style={{ gridTemplateColumns: COL }}
                >
                  {isNew && <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-emerald-400/70 animate-pulse" />}

                  <span className="font-mono text-[10px] text-zinc-500 tabular-nums self-center">#{log.id}</span>
                  <span className="font-mono text-[11px] text-zinc-500 tabular-nums self-center">{formatTime(log.eventTimestamp)}</span>
                  <span className="font-mono text-[11px] text-zinc-400 truncate self-center">{log.service ?? log.sourceType}</span>
                  <span className="text-[11px] text-zinc-300 flex items-center gap-1 truncate self-center">
                    <Server size={9} className="text-zinc-500 flex-shrink-0" />{log.username ?? "-"}
                  </span>
                  <span className="font-mono text-[11px] text-zinc-500 truncate self-center">{log.workingDirectory ?? "-"}</span>
                  <span className="font-mono text-[11px] text-zinc-400 truncate self-center">{log.command ?? "-"}</span>
                  <span className="min-w-0 self-center">
                    <span className={`block truncate text-[11px] font-semibold ${SEV[severity].text}`}>
                      {displayTitle(log)}
                      <span className="ml-2"><Badge level={severity} /></span>
                    </span>
                    <span className="mt-0.5 block truncate text-[10px] text-zinc-500">{displayDescription(log)}</span>
                  </span>
                  <span className="font-mono text-[11px] text-zinc-500 self-center">{log.targetUser ?? "-"}</span>
                  <span className="flex items-center justify-center self-center">
                    <ChevronDown size={13} className={`text-zinc-500 group-hover:text-zinc-400 transition-transform duration-200 ${isOpen ? "rotate-180 text-cyan-300" : ""}`} />
                  </span>
                </button>

                {/* Accordion */}
                <div className="overflow-hidden transition-all duration-300 ease-in-out"
                  style={{ maxHeight: isOpen ? "500px" : "0px" }}>
                  <div className="bg-[#070709] border-b border-zinc-800/80 px-4 py-4">

                    {/* Accordion header */}
                    <div className="flex items-center gap-3 mb-4">
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${SEV[severity].dot}`} />
                      <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
                        Détail de l'événement #{log.id} — {displayTitle(log)}
                      </span>
                      <div className="flex-1 h-px bg-zinc-800" />
                      <Badge level={severity} />
                      <span className="text-[10px] font-mono text-zinc-500">{formatTime(log.eventTimestamp)}</span>
                    </div>

                    {/* Two-column: summary pills + JSON */}
                    <div className="flex gap-5">

                      {/* Left: field summary */}
                      <div className="w-44 flex-shrink-0 space-y-3">
                        {([
                          ["Type",        eventLabel(log.eventType)],
                          ["Catégorie",   log.category ?? "-"],
                          ["Règle",       log.interpretationRuleId ?? "-"],
                          ["Service",     log.service ?? "-"],
                          ["Utilisateur", log.username ?? "-"],
                          ["PWD",         log.workingDirectory ?? "-"],
                          ["Cible",       log.targetUser ?? "-"],
                          ["Commande",    log.command ?? "-"],
                          ["Sévérité",    severity],
                          ["Reçue",       formatTime(log.receivedAt)],
                        ] as [string, string][]).map(([k, v]) => (
                          <div key={k}>
                            <p className="text-[9px] text-zinc-500 uppercase tracking-wider mb-0.5">{k}</p>
                            <p className={`text-[11px] font-mono truncate ${k === "Sévérité" ? SEV[severity].text : "text-zinc-300"}`}>{String(v)}</p>
                          </div>
                        ))}
                      </div>

                      {/* Right: JSON */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">Payload JSON</span>
                          <div className="flex-1 h-px bg-zinc-800" />
                          {/* macOS-style dots */}
                          <span className="w-2 h-2 rounded-full bg-red-500/50" />
                          <span className="w-2 h-2 rounded-full bg-amber-500/50" />
                          <span className="w-2 h-2 rounded-full bg-emerald-500/50" />
                        </div>
                        <JsonBlock data={{
                          id:          log.id,
                          timestamp:   log.eventTimestamp,
                          source_name: log.sourceName,
                          source_type: log.sourceType,
                          service:     log.service,
                          process_name: log.processName,
                          process_id:  log.processId,
                          host_name:   log.hostName,
                          event_type:  log.eventType,
                          libelle:     eventLabel(log.eventType),
                          severity:    log.severity,
                          human_severity: log.humanSeverity,
                          dangerosite: severity,
                          title:       log.title,
                          description: log.description,
                          category:    log.category,
                          icon:        log.icon,
                          interpretation_rule_id: log.interpretationRuleId,
                          interpretation_confidence: log.interpretationConfidence,
                          username:    log.username,
                          tty:         log.tty,
                          working_directory: log.workingDirectory,
                          target_user: log.targetUser,
                          command:     log.command,
                          message:     log.message,
                          received_at: log.receivedAt,
                          raw_payload: log.rawPayload,
                          normalized_payload: log.normalizedPayload,
                        }} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Micro status line ── */}
        <div className="flex items-center gap-4 px-4 py-2 border-t border-border bg-[#0d0d10] flex-shrink-0">
          <span className="text-[10px] font-mono text-zinc-600">
            Page <span className="text-zinc-400 font-semibold">{pagination.page}</span> / {pagination.totalPages} · {pagination.total} événement(s)
          </span>
          <span className="text-zinc-800 text-[10px]">—</span>
          <span className={`flex items-center gap-1.5 text-[10px] font-mono transition-colors ${autoScroll && playing ? "text-emerald-500/80" : "text-zinc-600"}`}>
            <span className={`w-1 h-1 rounded-full transition-colors ${autoScroll && playing ? "bg-emerald-500 animate-pulse" : "bg-zinc-700"}`} />
            Défilement automatique {autoScroll && playing ? "actif" : "inactif"}
          </span>
          {hasFilter && (
            <>
              <span className="text-zinc-800 text-[10px]">—</span>
              <span className="text-[10px] font-mono text-amber-500/70">Filtres appliqués</span>
            </>
          )}
          <span className="text-zinc-800 text-[10px]">—</span>
          <span className={`text-[10px] font-mono ${journalctlStatus?.running ? "text-emerald-500/80" : "text-zinc-600"}`}>
            journalctl -f {journalctlStatus?.running ? "actif" : "arrêté"}
          </span>
          <span className="ml-auto text-[10px] font-mono text-zinc-500">
            Màj: <span className="text-zinc-500">{new Date().toLocaleTimeString("fr-FR")}</span>
          </span>
          <button
            type="button"
            disabled={pagination.page <= 1 || loading}
            onClick={() => onQueryChange({ page: Math.max(1, pagination.page - 1) })}
            className="rounded border border-zinc-800 px-2 py-1 text-[10px] text-zinc-500 disabled:opacity-40"
          >
            Précédent
          </button>
          <button
            type="button"
            disabled={pagination.page >= pagination.totalPages || loading}
            onClick={() => onQueryChange({ page: pagination.page + 1 })}
            className="rounded border border-zinc-800 px-2 py-1 text-[10px] text-zinc-500 disabled:opacity-40"
          >
            Suivant
          </button>
        </div>
      </div>
    </main>
  );
}

// ── Rapports data & view ───────────────────────────────────────────────────────

type ReportStatus = "Prêt" | "En cours" | "Échec";
type ReportFormat = "PDF" | "CSV" | "JSON";

interface Report {
  id: number;
  nom: string;
  format: ReportFormat;
  debut: string;
  fin: string;
  taille: string;
  statut: ReportStatus;
  genere: string;
  services: string[];
  severites: string[];
}

const FORMAT_ICON_COLOR: Record<ReportFormat, { icon: string; bg: string; text: string }> = {
  PDF:  { icon: "PDF",  bg: "bg-red-500/10  border-red-500/20",  text: "text-red-400"   },
  CSV:  { icon: "CSV",  bg: "bg-emerald-500/10 border-emerald-500/20", text: "text-emerald-400" },
  JSON: { icon: "JSON", bg: "bg-cyan-400/10  border-cyan-400/20",  text: "text-cyan-300"  },
};

const STATUS_STYLE: Record<ReportStatus, { pill: string; dot: string; label: string }> = {
  "Prêt":     { pill: "bg-emerald-500/10 text-emerald-400 border-emerald-500/25", dot: "bg-emerald-400", label: "Prêt" },
  "En cours": { pill: "bg-cyan-400/10    text-cyan-300    border-cyan-400/25",    dot: "bg-cyan-300",    label: "En cours" },
  "Échec":    { pill: "bg-red-500/10     text-red-400     border-red-500/25",     dot: "bg-red-500",     label: "Échec" },
};

const SERVICES_LIST = ["Tous les services", "sshd.service", "systemd-logind", "sudo", "nginx", "auditd", "cron", "kernel", "firewalld", "fail2ban", "postgresql"];

function ReportSortButton({
  field,
  label,
  sortField,
  sortAsc,
  onSort,
}: {
  field: keyof Report;
  label: string;
  sortField: keyof Report;
  sortAsc: boolean;
  onSort: (field: keyof Report) => void;
}) {
  return (
    <button onClick={() => onSort(field)} className="flex items-center gap-1 group hover:text-zinc-300 transition-colors">
      {label}
      <span className="flex flex-col opacity-40 group-hover:opacity-80">
        <ChevronUp size={8} className={sortField === field && sortAsc ? "opacity-100 text-cyan-300" : ""} />
        <ChevronDown size={8} className={sortField === field && !sortAsc ? "opacity-100 text-cyan-300" : ""} style={{ marginTop: -2 }} />
      </span>
    </button>
  );
}

function RapportsView() {
  // Form state
  const [dateDebut,   setDateDebut]   = useState("2026-06-01");
  const [dateFin,     setDateFin]     = useState("2026-06-13");
  const [selService,  setSelService]  = useState("Tous les services");
  const [selFormat,   setSelFormat]   = useState<ReportFormat>("PDF");
  const [sevCritique, setSevCritique] = useState(true);
  const [sevAvert,    setSevAvert]    = useState(true);
  const [sevInfo,     setSevInfo]     = useState(false);
  const [reportName,  setReportName]  = useState("rapport_audit_");
  const [generating,  setGenerating]  = useState(false);
  const [generated,   setGenerated]   = useState(false);
  const [reports,     setReports]     = useState<Report[]>([]);
  const [sortField,   setSortField]   = useState<keyof Report>("id");
  const [sortAsc,     setSortAsc]     = useState(false);
  const [filterStatus, setFilterStatus] = useState<ReportStatus | "Tous">("Tous");

  const handleGenerate = () => {
    if (generating) return;
    setGenerating(true);
    setGenerated(false);
    setTimeout(() => {
      const sevs = [sevCritique && "CRITIQUE", sevAvert && "AVERTISSEMENT", sevInfo && "INFO"].filter(Boolean) as string[];
      const newReport: Report = {
        id: reports.length + 1,
        nom: reportName + new Date().toISOString().slice(0, 10).replace(/-/g, ""),
        format: selFormat,
        debut: dateDebut.split("-").reverse().join("/"),
        fin:   dateFin.split("-").reverse().join("/"),
        taille: selFormat === "JSON" ? "1.2 Mo" : selFormat === "PDF" ? "2.1 Mo" : "340 Ko",
        statut: "Prêt",
        genere: new Date().toLocaleDateString("fr-FR") + " à " + new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
        services: [selService],
        severites: sevs,
      };
      setReports((p) => [newReport, ...p]);
      void trackUserAction("GENERATE_REPORT", newReport.nom, {
        format: newReport.format,
        service: selService,
        severites: newReport.severites,
        periode: { debut: dateDebut, fin: dateFin },
      });
      const format = selFormat.toLowerCase() as "json" | "csv" | "pdf";
      window.open(getExportUrl(format, {
        startDate: dateDebut,
        endDate: dateFin,
        action: reportName,
      }), "_blank", "noopener,noreferrer");
      setGenerating(false);
      setGenerated(true);
      setTimeout(() => setGenerated(false), 4000);
    }, 2200);
  };

  const sorted = useMemo(() => {
    const base = filterStatus === "Tous" ? reports : reports.filter((r) => r.statut === filterStatus);
    return [...base].sort((a, b) => {
      const av = a[sortField]; const bv = b[sortField];
      if (typeof av === "number" && typeof bv === "number") return sortAsc ? av - bv : bv - av;
      return sortAsc ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
  }, [reports, sortField, sortAsc, filterStatus]);

  const toggleSort = (field: keyof Report) => {
    if (sortField === field) setSortAsc((p) => !p);
    else { setSortField(field); setSortAsc(true); }
  };

  const readyCnt   = reports.filter((r) => r.statut === "Prêt").length;
  const pendingCnt = reports.filter((r) => r.statut === "En cours").length;
  const failCnt    = reports.filter((r) => r.statut === "Échec").length;

  return (
    <main
      className="flex-1 overflow-y-auto px-6 py-5"
      style={{ scrollbarWidth: "none" } as React.CSSProperties}
    >
      {/* ── Page title ── */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-600/30 flex items-center justify-center flex-shrink-0">
            <FileDown size={15} className="text-indigo-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-zinc-100">Génération de Rapports d'Audit</h2>
            <p className="text-[11px] text-zinc-600 font-mono mt-0.5">
              {readyCnt} prêt{readyCnt > 1 ? "s" : ""} · {pendingCnt} en cours · {failCnt} en échec
            </p>
          </div>
        </div>
        {/* Status filter pills */}
        <div className="flex items-center gap-2">
          {(["Tous", "Prêt", "En cours", "Échec"] as const).map((s) => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`px-3 py-1 rounded-full text-[11px] font-medium border transition-all ${
                filterStatus === s
                  ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-200"
                  : "border-zinc-800 text-zinc-600 hover:text-zinc-300 hover:border-zinc-700"
              }`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* ── Two-column layout ── */}
      <div className="flex gap-5 items-start">

        {/* ═══════════════════════════════════════════════════════════
            LEFT COLUMN — Form (1/3)
        ═══════════════════════════════════════════════════════════ */}
        <aside className="w-80 flex-shrink-0 flex flex-col gap-4">

          {/* Form card */}
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            {/* Card header */}
            <div className="flex items-center gap-2.5 px-5 py-4 border-b border-border bg-[#0d0d10]">
              <FileCog size={15} className="text-indigo-400" />
              <h3 className="text-sm font-semibold">Nouveau Rapport Customisé</h3>
            </div>

            <div className="px-5 py-5 space-y-5">

              {/* Nom du rapport */}
              <div>
                <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest block mb-2">
                  Nom du fichier
                </label>
                <input
                  type="text"
                  value={reportName}
                  onChange={(e) => setReportName(e.target.value)}
                  className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-xs font-mono text-foreground placeholder:text-zinc-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 transition-all"
                  placeholder="rapport_audit_..."
                />
              </div>

              {/* Date range */}
              <div>
                <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest block mb-2 flex items-center gap-1.5">
                  <CalendarDays size={10} />Période couverte
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-[10px] text-zinc-500 mb-1 font-mono">Du</p>
                    <input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)}
                      className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-xs font-mono text-zinc-300 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 transition-all [color-scheme:dark]" />
                  </div>
                  <div>
                    <p className="text-[10px] text-zinc-500 mb-1 font-mono">Au</p>
                    <input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)}
                      className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-xs font-mono text-zinc-300 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 transition-all [color-scheme:dark]" />
                  </div>
                </div>
              </div>

              {/* Service */}
              <div>
                <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest block mb-2">Service ciblé</label>
                <div className="relative">
                  <select value={selService} onChange={(e) => setSelService(e.target.value)}
                    className="w-full appearance-none bg-muted border border-border rounded-lg pl-3 pr-7 py-2 text-xs text-zinc-300 focus:outline-none focus:border-cyan-500/50 cursor-pointer">
                    {SERVICES_LIST.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <ChevronDown size={11} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none" />
                </div>
              </div>

              {/* Sévérité checkboxes */}
              <div>
                <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest block mb-3">Niveaux de sévérité</label>
                <div className="space-y-2.5">
                  {([
                    { label: "Critique",      color: "text-red-400",     checked: sevCritique, set: setSevCritique, dot: "bg-red-500"     },
                    { label: "Avertissement", color: "text-amber-400",   checked: sevAvert,    set: setSevAvert,    dot: "bg-amber-500"   },
                    { label: "Info",          color: "text-emerald-400", checked: sevInfo,     set: setSevInfo,     dot: "bg-emerald-400" },
                  ] as const).map(({ label, color, checked, set, dot }) => (
                    <button key={label} onClick={() => set((p) => !p)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all group hover:border-zinc-600"
                      style={{ borderColor: checked ? "transparent" : undefined, backgroundColor: checked ? "transparent" : undefined }}
                      data-checked={checked}>
                      <div className={`flex-shrink-0 transition-all ${checked ? color : "text-zinc-500"}`}>
                        {checked ? <CheckSquare size={15} /> : <Square size={15} />}
                      </div>
                      <div className="flex items-center gap-2 flex-1">
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${checked ? dot : "bg-zinc-700"}`} />
                        <span className={`text-xs font-medium transition-colors ${checked ? color : "text-zinc-600"}`}>{label}</span>
                      </div>
                      {checked && (
                        <span className={`text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${color} bg-current/10`}
                          style={{ backgroundColor: `color-mix(in srgb, currentColor 12%, transparent)` }}>
                          inclus
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Format selector */}
              <div>
                <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest block mb-3">Format d'export</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["PDF", "CSV", "JSON"] as const).map((fmt) => {
                    const s = FORMAT_ICON_COLOR[fmt];
                    const active = selFormat === fmt;
                    return (
                      <button key={fmt} onClick={() => setSelFormat(fmt)}
                        className={`flex flex-col items-center gap-1.5 py-3 rounded-lg border text-xs font-mono font-bold transition-all ${
                          active ? `${s.bg} ${s.text} border-current/40` : "border-zinc-800 text-zinc-600 hover:border-zinc-700 hover:text-zinc-400"
                        }`}>
                        <FileDown size={16} className={active ? s.text : "text-zinc-500"} />
                        {fmt}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Divider */}
              <div className="h-px bg-border" />

              {/* Summary preview */}
              <div className="bg-muted/50 border border-border/50 rounded-lg px-4 py-3 space-y-1.5">
                <p className="text-[10px] text-zinc-600 uppercase tracking-widest font-semibold mb-2">Aperçu de la configuration</p>
                {[
                  ["Période",   `${dateDebut.split("-").reverse().join("/")} → ${dateFin.split("-").reverse().join("/")}`],
                  ["Service",   selService],
                  ["Format",    selFormat],
                  ["Sévérités", [sevCritique && "CRITIQUE", sevAvert && "AVERT.", sevInfo && "INFO"].filter(Boolean).join(", ") || "Aucune"],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-start justify-between gap-2">
                    <span className="text-[10px] text-zinc-500 font-mono">{k}</span>
                    <span className="text-[10px] text-zinc-400 font-mono text-right truncate max-w-[60%]">{String(v)}</span>
                  </div>
                ))}
              </div>

              {/* Generate button */}
              <button
                onClick={handleGenerate}
                disabled={generating}
                className={`w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-semibold transition-all ${
                  generated
                    ? "bg-emerald-600/20 border border-emerald-600/40 text-emerald-400 cursor-default"
                    : generating
                    ? "bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 cursor-wait"
                    : "bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-500 shadow-lg shadow-indigo-900/30 active:scale-[0.98]"
                }`}
              >
                {generating ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    Génération en cours…
                  </>
                ) : generated ? (
                  <>
                    <CheckCircle2 size={15} />
                    Rapport généré !
                  </>
                ) : (
                  <>
                    <FileDown size={15} />
                    Générer le document
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Quick stats card */}
          <div className="bg-card border border-border rounded-lg px-5 py-4">
            <p className="text-[10px] text-zinc-600 uppercase tracking-widest font-semibold mb-3">Statistiques d'archive</p>
            <div className="space-y-2.5">
              {[
                { label: "Rapports générés",    value: reports.length,                  color: "text-foreground" },
                { label: "Volume total archivé", value: "15.4 Mo",                       color: "text-foreground" },
                { label: "Dernier export",       value: "Aujourd'hui à 20:01",           color: "text-zinc-400"  },
                { label: "Format le + utilisé",  value: "PDF",                           color: "text-indigo-400"},
              ].map(({ label, value, color }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-[11px] text-zinc-600">{label}</span>
                  <span className={`text-[11px] font-mono font-semibold ${color}`}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* ═══════════════════════════════════════════════════════════
            RIGHT COLUMN — Table (2/3)
        ═══════════════════════════════════════════════════════════ */}
        <div className="flex-1 min-w-0 flex flex-col gap-0 bg-card border border-border rounded-lg overflow-hidden">

          {/* Table header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-[#0d0d10]">
            <div className="flex items-center gap-2">
              <Clock size={14} className="text-indigo-400" />
              <h3 className="text-sm font-semibold">Historique des Rapports Archivés</h3>
              <span className="ml-2 text-[10px] font-mono text-zinc-600 bg-zinc-800/60 px-2 py-0.5 rounded-full">
                {sorted.length} rapport{sorted.length > 1 ? "s" : ""}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-zinc-600 font-mono">Trié par :</span>
              <span className="text-[11px] text-zinc-400 font-mono">{sortField}</span>
            </div>
          </div>

          {/* Column headers */}
          <div
            className="grid gap-3 px-5 py-2.5 border-b border-border bg-muted/30 text-[10px] font-semibold text-zinc-600 uppercase tracking-widest"
            style={{ gridTemplateColumns: "2fr 1.2fr 80px 100px 110px" }}
          >
            <ReportSortButton field="nom" label="Nom du fichier" sortField={sortField} sortAsc={sortAsc} onSort={toggleSort} />
            <ReportSortButton field="debut" label="Période" sortField={sortField} sortAsc={sortAsc} onSort={toggleSort} />
            <ReportSortButton field="taille" label="Taille" sortField={sortField} sortAsc={sortAsc} onSort={toggleSort} />
            <ReportSortButton field="statut" label="Statut" sortField={sortField} sortAsc={sortAsc} onSort={toggleSort} />
            <span>Actions</span>
          </div>

          {/* Rows */}
          <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" } as React.CSSProperties}>
            {sorted.map((r, idx) => {
              const fmt = FORMAT_ICON_COLOR[r.format];
              const st  = STATUS_STYLE[r.statut];
              return (
                <div
                  key={r.id}
                  className={`grid gap-3 px-5 py-3.5 border-b border-border/40 text-xs items-center transition-colors group ${
                    idx % 2 === 0 ? "bg-card" : "bg-[#0f0f12]"
                  } hover:bg-indigo-600/[0.04]`}
                  style={{ gridTemplateColumns: "2fr 1.2fr 80px 100px 110px" }}
                >
                  {/* Filename + format badge */}
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`flex-shrink-0 text-[9px] font-mono font-bold px-1.5 py-1 rounded border ${fmt.bg} ${fmt.text}`}>
                      {fmt.icon}
                    </span>
                    <div className="min-w-0">
                      <p className="font-mono text-zinc-200 truncate text-[11px]">{r.nom}.{r.format.toLowerCase()}</p>
                      <p className="text-[10px] text-zinc-500 font-mono mt-0.5">Généré le {r.genere}</p>
                    </div>
                  </div>

                  {/* Période */}
                  <div>
                    <p className="font-mono text-zinc-400 text-[11px]">{r.debut}</p>
                    <p className="font-mono text-zinc-500 text-[10px]">→ {r.fin}</p>
                  </div>

                  {/* Taille */}
                  <div className="flex items-center gap-1.5">
                    <HardDrive size={10} className="text-zinc-500 flex-shrink-0" />
                    <span className="font-mono text-zinc-400 text-[11px]">{r.taille}</span>
                  </div>

                  {/* Statut */}
                  <div>
                    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded border text-[10px] font-mono font-semibold ${st.pill}`}>
                      <span className={`w-1 h-1 rounded-full flex-shrink-0 ${st.dot} ${r.statut === "En cours" ? "animate-pulse" : ""}`} />
                      {st.label}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5">
                    {r.statut === "Prêt" && (
                      <button
                        title="Télécharger"
                        onClick={() => void trackUserAction("REPORT_DOWNLOADED", `${r.nom}.${r.format.toLowerCase()}`, { reportId: r.id, format: r.format })}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-indigo-600/10 border border-indigo-600/25 text-indigo-400 hover:bg-indigo-600/20 transition-all"
                      >
                        <Download size={12} />
                        Télécharger
                      </button>
                    )}
                    {r.statut === "En cours" && (
                      <span className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-zinc-600 border border-zinc-800 cursor-wait">
                        <Loader2 size={11} className="animate-spin" />
                        En attente
                      </span>
                    )}
                    {r.statut === "Échec" && (
                      <span className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-red-500 border border-red-900/40 bg-red-500/5">
                        <XCircleIcon size={11} />
                        Relancer
                      </span>
                    )}
                    <button
                      title="Supprimer"
                      onClick={() => setReports((p) => p.filter((x) => x.id !== r.id))}
                      className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Trash size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Table footer */}
          <div className="flex items-center justify-between px-5 py-2.5 border-t border-border bg-[#0d0d10]">
            <span className="text-[10px] font-mono text-zinc-500">
              {sorted.length} rapport(s) · Filtre : <span className="text-zinc-500">{filterStatus}</span>
            </span>
            <div className="flex items-center gap-3">
              <span className={`flex items-center gap-1.5 text-[10px] font-mono ${readyCnt > 0 ? "text-emerald-600" : "text-zinc-500"}`}>
                <CheckCircle2 size={10} />{readyCnt} prêt{readyCnt > 1 ? "s" : ""}
              </span>
              <span className="text-zinc-800">·</span>
              <span className={`flex items-center gap-1.5 text-[10px] font-mono ${pendingCnt > 0 ? "text-cyan-500" : "text-zinc-500"}`}>
                <Loader2 size={10} />{pendingCnt} en cours
              </span>
              <span className="text-zinc-800">·</span>
              <span className={`flex items-center gap-1.5 text-[10px] font-mono ${failCnt > 0 ? "text-red-700" : "text-zinc-500"}`}>
                <XCircleIcon size={10} />{failCnt} en échec
              </span>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

// ── Profil view ───────────────────────────────────────────────────────────────

function ProfileReadOnlyField({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
        {label}
      </span>
      <div className="relative">
        <Icon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
        <input
          readOnly
          value={value}
          className="w-full rounded-lg border border-border bg-muted px-3 py-3 pl-10 text-xs font-medium text-zinc-200 outline-none"
        />
      </div>
    </label>
  );
}

function ProfilView() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileForm, setProfileForm] = useState({ firstName: "", lastName: "", email: "" });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      try {
        const data = await getProfile();
        setProfile(data);
        setProfileForm({
          firstName: data.firstName ?? "",
          lastName: data.lastName ?? "",
          email: data.email ?? "",
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Impossible de charger le profil");
      } finally {
        setLoading(false);
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const handleProfileSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const updated = await updateProfile(profileForm);
      setProfile(updated);
      setMessage("Profil mis à jour");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de sauvegarder le profil");
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError("Les mots de passe ne correspondent pas");
      return;
    }

    try {
      await updatePassword(passwordForm.currentPassword, passwordForm.newPassword);
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setMessage("Mot de passe modifié");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de modifier le mot de passe");
    }
  };

  return (
    <main
      className="flex-1 overflow-y-auto px-4 py-5 md:px-6"
      style={{ scrollbarWidth: "none" } as React.CSSProperties}
    >
      <div className="mb-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-cyan-500/30 bg-cyan-500/20">
            <UserCog size={15} className="text-cyan-300" />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-zinc-100">Mon Profil</h2>
            <p className="mt-0.5 text-xs font-mono text-zinc-500">
              Identité, rôle et sécurité du compte
            </p>
          </div>
        </div>
      </div>

      {loading && (
        <div className="rounded-lg border border-border bg-card px-4 py-3 text-xs font-mono text-zinc-500">
          Chargement du profil...
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-lg border border-red-500/25 bg-red-500/10 px-4 py-3 text-xs font-mono text-red-300">
          {error}
        </div>
      )}
      {message && (
        <div className="mb-4 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-xs font-mono text-emerald-300">
          {message}
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,0.92fr)_minmax(360px,0.68fr)]">
        <section className="rounded-xl border border-zinc-800/80 bg-card/95 shadow-[0_18px_50px_rgba(0,0,0,0.22)]">
          <div className="flex items-center gap-2.5 border-b border-border bg-[#0d0d10] px-5 py-3.5">
            <ShieldCheck size={15} className="text-cyan-300" />
            <h3 className="text-sm font-semibold">Informations Générales</h3>
          </div>

          <form onSubmit={handleProfileSubmit} className="space-y-5 px-5 py-5">
            <div className="grid gap-4 md:grid-cols-3">
              <ProfileReadOnlyField label="Username" value={profile?.username ?? "-"} icon={UserCog} />
              <ProfileReadOnlyField label="ID" value={String(profile?.id ?? "-")} icon={KeyRound} />
              <ProfileReadOnlyField label="Rôle actuel" value={profile?.role ?? "-"} icon={ShieldCheck} />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {([
                ["Prénom", "firstName"],
                ["Nom", "lastName"],
                ["Email", "email"],
              ] as const).map(([label, key]) => (
                <label key={key} className="block">
                  <span className="mb-2 block text-[10px] font-semibold uppercase tracking-widest text-zinc-500">{label}</span>
                  <input
                    type={key === "email" ? "email" : "text"}
                    value={profileForm[key]}
                    onChange={(event) => setProfileForm((current) => ({ ...current, [key]: event.target.value }))}
                    className="w-full rounded-lg border border-border bg-muted px-3 py-3 text-xs text-zinc-200 outline-none transition focus:border-cyan-400/45 focus:ring-1 focus:ring-cyan-400/25"
                  />
                </label>
              ))}
            </div>

            <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 px-4 py-3">
              <div className="flex items-center gap-2.5">
                <CalendarDays size={14} className="text-cyan-300" />
                <p className="text-xs font-medium text-zinc-300">
                  Membre depuis {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString("fr-FR") : "-"} · Dernière connexion {profile?.lastLoginAt ? new Date(profile.lastLoginAt).toLocaleString("fr-FR") : "jamais"}
                </p>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-4 py-3 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-400/20 disabled:opacity-60"
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              Enregistrer le profil
            </button>
          </form>
        </section>

        <section className="rounded-xl border border-zinc-800/80 bg-card/95 shadow-[0_18px_50px_rgba(0,0,0,0.22)]">
          <div className="flex items-center gap-2.5 border-b border-border bg-[#0d0d10] px-5 py-3.5">
            <KeyRound size={15} className="text-amber-400" />
            <h3 className="text-sm font-semibold">Changer le mot de passe</h3>
          </div>

          <form onSubmit={handlePasswordSubmit} className="space-y-4 px-5 py-5">
            {[
              ["Mot de passe actuel", "currentPassword", "current-password"],
              ["Nouveau mot de passe", "newPassword", "new-password"],
              ["Confirmer le nouveau mot de passe", "confirmPassword", "new-password"],
            ].map(([label, key, autoComplete]) => (
              <label key={label} className="block">
                <span className="mb-2 block text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
                  {label}
                </span>
                <div className="relative">
                  <KeyRound size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
                  <input
                    type="password"
                    value={passwordForm[key as keyof typeof passwordForm]}
                    onChange={(event) => setPasswordForm((current) => ({ ...current, [key]: event.target.value }))}
                    autoComplete={autoComplete}
                    className="w-full rounded-lg border border-border bg-muted px-3 py-3 pl-10 text-xs text-zinc-200 outline-none transition placeholder:text-zinc-500 focus:border-amber-500/45 focus:ring-1 focus:ring-amber-500/25"
                    placeholder="••••••••••••"
                  />
                </div>
              </label>
            ))}

            <button
              type="submit"
              className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-300 shadow-lg shadow-amber-950/20 transition hover:bg-amber-500/20 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/35"
            >
              <Save size={15} />
              Enregistrer les modifications
            </button>

          </form>
        </section>
      </div>
    </main>
  );
}

// ── Journal utilisateur view ─────────────────────────────────────────────────

const ACTION_STYLE: Record<string, { badge: string; dot: string }> = {
  SUCCESS: {
    badge: "border-emerald-500/25 bg-emerald-500/10 text-emerald-400",
    dot: "bg-emerald-400",
  },
  FAILED: {
    badge: "border-red-500/25 bg-red-500/10 text-red-400",
    dot: "bg-red-500",
  },
};

function formatActionDate(value: string) {
  return new Date(value).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function SessionsView() {
  const [actions, setActions] = useState<UserActionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const currentUser = getCurrentUser();

  const loadActions = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const rows = await getMyUserActions(100);
      setActions(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de charger le journal");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void trackUserAction("VIEW_ACTION_JOURNAL", "Journal d'actions");
    const timer = window.setTimeout(() => {
      void loadActions();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadActions]);

  return (
    <main
      className="flex-1 overflow-y-auto px-4 py-5 md:px-6"
      style={{ scrollbarWidth: "none" } as React.CSSProperties}
    >
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-cyan-500/30 bg-cyan-500/20">
            <History size={15} className="text-cyan-300" />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-zinc-100">Journal de mes actions</h2>
            <p className="mt-0.5 text-xs font-mono text-zinc-500">
              Audit applicatif du compte {currentUser?.username ?? "connecté"}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void loadActions()}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-cyan-500/25 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-300 transition hover:bg-cyan-500/20"
        >
          <RotateCw size={14} className={loading ? "animate-spin" : ""} />
          Rafraîchir
        </button>
      </div>

      <section className="overflow-hidden rounded-xl border border-zinc-800/80 bg-card/95 shadow-[0_18px_50px_rgba(0,0,0,0.22)]">
        <div className="flex items-center justify-between border-b border-border bg-[#0d0d10] px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <ShieldCheck size={15} className="text-cyan-300" />
            <h3 className="text-sm font-semibold">Historique des actions utilisateur</h3>
          </div>
          <span className="rounded-full bg-zinc-800/70 px-2.5 py-1 text-[10px] font-mono font-semibold text-zinc-500">
            {actions.length} entrée{actions.length > 1 ? "s" : ""}
          </span>
        </div>

        <div className="hidden grid-cols-[175px_190px_1fr_150px_1fr] gap-4 border-b border-border bg-muted/30 px-5 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-zinc-600 md:grid">
          <span>Date & Heure</span>
          <span>Action</span>
          <span>Ressource</span>
          <span>Adresse IP Source</span>
          <span>Navigateur/OS détecté</span>
        </div>

        <div className="divide-y divide-border/40">
          {loading ? (
            <div className="flex h-40 flex-col items-center justify-center text-zinc-500">
              <Loader2 size={24} className="mb-2 animate-spin opacity-60" />
              <p className="text-xs font-mono">Chargement du journal...</p>
            </div>
          ) : error ? (
            <div className="flex h-40 flex-col items-center justify-center text-red-400">
              <AlertTriangle size={24} className="mb-2 opacity-60" />
              <p className="text-xs font-mono">{error}</p>
            </div>
          ) : actions.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center text-zinc-500">
              <History size={28} className="mb-2 opacity-20" />
              <p className="text-xs font-mono">Aucune action enregistrée pour ce compte</p>
            </div>
          ) : (
            actions.map((action) => {
              const style = ACTION_STYLE[action.status] ?? ACTION_STYLE.SUCCESS;
              const label = USER_ACTION_LABELS[action.action_type] ?? action.action_type;

              return (
                <div
                  key={action.id}
                  className="grid gap-3 px-5 py-4 text-xs transition hover:bg-cyan-400/[0.06] hover:shadow-[inset_2px_0_0_rgba(59,130,246,0.45)] md:grid-cols-[175px_190px_1fr_150px_1fr] md:items-center md:gap-4"
                >
                  <div>
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-500 md:hidden">
                      Date & Heure
                    </p>
                    <p className="font-mono text-zinc-300">{formatActionDate(action.created_at)}</p>
                  </div>

                  <div>
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-500 md:hidden">
                      Action
                    </p>
                    <span className={`inline-flex items-center gap-1.5 rounded border px-2.5 py-1 text-[10px] font-mono font-semibold ${style.badge}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
                      {label}
                    </span>
                  </div>

                  <div className="min-w-0">
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-500 md:hidden">
                      Ressource
                    </p>
                    <p className="truncate font-mono text-zinc-400">{action.resource ?? "Application"}</p>
                  </div>

                  <div>
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-500 md:hidden">
                      Adresse IP Source
                    </p>
                    <p className="font-mono text-zinc-400">{action.ip_source ?? "IP inconnue"}</p>
                  </div>

                  <div className="min-w-0">
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-500 md:hidden">
                      Navigateur/OS détecté
                    </p>
                    <p className="truncate font-mono text-zinc-500">{action.user_agent ?? "Agent inconnu"}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
    </main>
  );
}

// ── Administration view ──────────────────────────────────────────────────────

const ROLE_OPTIONS = ["user", "auditor", "admin", "super_admin"] as const;

function AdministrationView() {
  const currentUser = getCurrentUser();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadUsers = useCallback(async (page = pagination.page) => {
    setLoading(true);
    setError(null);

    try {
      const result = await getUsers({ page, limit: pagination.limit, search, role });
      setUsers(result.data);
      setPagination(result.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de charger les utilisateurs");
    } finally {
      setLoading(false);
    }
  }, [pagination.limit, pagination.page, search, role]);

  useEffect(() => {
    void trackUserAction("ADMIN_SECTION_VIEWED", "Administration");
    const timer = window.setTimeout(() => {
      void loadUsers(1);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadUsers]);

  const handleRoleChange = async (user: UserProfile, nextRole: string) => {
    try {
      await updateUser(user.id, { role: nextRole });
      await trackUserAction("ROLE_UPDATED", `Utilisateur #${user.id}`, { role: nextRole });
      void loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de modifier le rôle");
    }
  };

  const handleDeactivate = async (user: UserProfile) => {
    try {
      await deleteUser(user.id);
      void loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de désactiver l'utilisateur");
    }
  };

  const exportUrl = (format: "json" | "csv" | "pdf") => getExportUrl(format);

  if (!isAdminRole(currentUser?.role)) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center text-zinc-500">
        <ShieldCheck size={36} className="mb-3 opacity-30" />
        <p className="text-sm font-mono">Accès réservé aux administrateurs</p>
      </main>
    );
  }

  return (
    <main className="flex-1 overflow-y-auto px-4 py-5 md:px-6" style={{ scrollbarWidth: "none" } as React.CSSProperties}>
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-cyan-500/30 bg-cyan-500/20">
            <UserCog size={15} className="text-cyan-300" />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-zinc-100">Administration</h2>
            <p className="mt-0.5 text-xs font-mono text-zinc-500">
              Gestion utilisateurs, rôles, exports et activité administrateur
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {(["json", "csv", "pdf"] as const).map((format) => (
            <a
              key={format}
              href={exportUrl(format)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/25 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/20"
            >
              <Download size={13} />
              Export {format.toUpperCase()}
            </a>
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/25 bg-red-500/10 px-4 py-3 text-xs font-mono text-red-300">
          {error}
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="overflow-hidden rounded-xl border border-zinc-800/80 bg-card/95 shadow-[0_18px_50px_rgba(0,0,0,0.22)]">
          <div className="flex flex-wrap items-center gap-3 border-b border-border bg-[#0d0d10] px-5 py-3.5">
            <h3 className="text-sm font-semibold">Gestion utilisateurs</h3>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Recherche"
              className="ml-auto rounded-lg border border-border bg-muted px-3 py-2 text-xs text-zinc-200 outline-none"
            />
            <select
              value={role}
              onChange={(event) => setRole(event.target.value)}
              className="rounded-lg border border-border bg-muted px-3 py-2 text-xs text-zinc-200 outline-none"
            >
              <option value="">Tous les rôles</option>
              {ROLE_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <button
              onClick={() => void loadUsers(1)}
              className="rounded-lg border border-cyan-500/25 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-300"
            >
              Filtrer
            </button>
          </div>

          <div className="hidden grid-cols-[60px_1fr_1fr_150px_120px_130px] gap-3 border-b border-border bg-muted/30 px-5 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-zinc-600 md:grid">
            <span>ID</span>
            <span>Utilisateur</span>
            <span>Email</span>
            <span>Rôle</span>
            <span>Statut</span>
            <span>Actions</span>
          </div>

          <div className="divide-y divide-border/40">
            {loading ? (
              <div className="flex h-40 items-center justify-center text-xs font-mono text-zinc-500">
                <Loader2 size={18} className="mr-2 animate-spin" /> Chargement...
              </div>
            ) : users.length === 0 ? (
              <div className="flex h-40 items-center justify-center text-xs font-mono text-zinc-500">
                Aucun utilisateur
              </div>
            ) : users.map((user) => (
              <div key={user.id} className="grid gap-3 px-5 py-3 text-xs md:grid-cols-[60px_1fr_1fr_150px_120px_130px] md:items-center">
                <span className="font-mono text-zinc-500">#{user.id}</span>
                <span className="text-zinc-200">{user.username}</span>
                <span className="truncate font-mono text-zinc-500">{user.email || "-"}</span>
                <select
                  value={user.role}
                  disabled={currentUser?.role !== "super_admin" && !["user", "auditor"].includes(user.role)}
                  onChange={(event) => void handleRoleChange(user, event.target.value)}
                  className="rounded-lg border border-border bg-muted px-2 py-1.5 text-xs text-zinc-200 outline-none disabled:opacity-50"
                >
                  {ROLE_OPTIONS.map((item) => (
                    <option
                      key={item}
                      value={item}
                      disabled={currentUser?.role !== "super_admin" && !["user", "auditor"].includes(item)}
                    >
                      {item}
                    </option>
                  ))}
                </select>
                <span className={user.isActive ? "text-emerald-400" : "text-red-400"}>
                  {user.isActive ? "Actif" : "Désactivé"}
                </span>
                <button
                  disabled={user.id === currentUser?.id || !user.isActive}
                  onClick={() => void handleDeactivate(user)}
                  className="rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300 disabled:opacity-40"
                >
                  Désactiver
                </button>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between border-t border-border bg-[#0d0d10] px-5 py-3">
            <span className="text-[10px] font-mono text-zinc-500">
              Page {pagination.page} / {pagination.totalPages} · {pagination.total} utilisateur(s)
            </span>
            <div className="flex gap-2">
              <button disabled={pagination.page <= 1} onClick={() => void loadUsers(pagination.page - 1)} className="rounded border border-zinc-800 px-2 py-1 text-[10px] text-zinc-500 disabled:opacity-40">Précédent</button>
              <button disabled={pagination.page >= pagination.totalPages} onClick={() => void loadUsers(pagination.page + 1)} className="rounded border border-zinc-800 px-2 py-1 text-[10px] text-zinc-500 disabled:opacity-40">Suivant</button>
            </div>
          </div>
        </section>

        <aside className="space-y-5">
          <section className="rounded-xl border border-zinc-800/80 bg-card/95 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.22)]">
            <h3 className="text-sm font-semibold">Historique exports</h3>
            <p className="mt-2 text-xs leading-relaxed text-zinc-500">
              Les exports JSON, CSV et PDF sont journalisés dans `user_action_logs` avec le type `REPORT_EXPORTED`.
            </p>
          </section>
          <section className="rounded-xl border border-zinc-800/80 bg-card/95 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.22)]">
            <h3 className="text-sm font-semibold">Activité administrateurs</h3>
            <p className="mt-2 text-xs leading-relaxed text-zinc-500">
              Les changements de rôle, désactivations et consultations admin apparaissent en temps réel dans le dashboard audit.
            </p>
          </section>
        </aside>
      </div>
    </main>
  );
}

// ── Sécurité SSH view ─────────────────────────────────────────────────────────

const SSH_KEYS = [
  {
    name: "Clé Kali Bureau",
    fingerprint: "SHA256:W8k3pQx7...Lm42nA",
    type: "ed25519",
    addedAt: "Ajoutée le 22/06/2026",
  },
  {
    name: "Clé AWS Bastion",
    fingerprint: "SHA256:Zp91vR6c...Qe77sT",
    type: "rsa",
    addedAt: "Ajoutée le 18/06/2026",
  },
  {
    name: "Clé Production Node",
    fingerprint: "SHA256:K1m9dY2a...Px03hL",
    type: "ed25519",
    addedAt: "Ajoutée le 12/06/2026",
  },
];

function SshSecurityView() {
  const [passwordAccessDisabled, setPasswordAccessDisabled] = useState(true);

  return (
    <main
      className="flex-1 overflow-y-auto px-4 py-5 md:px-6"
      style={{ scrollbarWidth: "none" } as React.CSSProperties}
    >
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-cyan-500/30 bg-cyan-500/20">
            <ShieldCheck size={15} className="text-cyan-300" />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-zinc-100">Sécurité & Clés SSH</h2>
            <p className="mt-0.5 text-xs font-mono text-zinc-500">
              Gestion des accès administrateur aux machines surveillées
            </p>
          </div>
        </div>

        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-mono font-semibold text-emerald-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Authentification forte active
        </span>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="space-y-5">
          <div className="overflow-hidden rounded-xl border border-zinc-800/80 bg-card/95 shadow-[0_18px_50px_rgba(0,0,0,0.22)]">
            <div className="flex items-center justify-between border-b border-border bg-[#0d0d10] px-5 py-3.5">
              <div className="flex items-center gap-2.5">
                <KeyRound size={15} className="text-cyan-300" />
                <h3 className="text-sm font-semibold">Clés SSH Autorisées</h3>
              </div>
              <span className="rounded-full bg-zinc-800/70 px-2.5 py-1 text-[10px] font-mono font-semibold text-zinc-500">
                {SSH_KEYS.length} clés
              </span>
            </div>

            <div className="divide-y divide-border/40">
              {SSH_KEYS.map((key) => (
                <div
                  key={key.fingerprint}
                  className="grid gap-3 px-5 py-4 transition hover:bg-cyan-400/[0.06] hover:shadow-[inset_2px_0_0_rgba(59,130,246,0.45)] md:grid-cols-[minmax(0,1fr)_170px_110px] md:items-center"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-cyan-500/20 bg-cyan-500/10">
                        <KeyRound size={14} className="text-cyan-300" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-zinc-100">{key.name}</p>
                        <p className="mt-0.5 text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                          {key.type} · {key.addedAt}
                        </p>
                      </div>
                    </div>
                  </div>

                  <p className="font-mono text-xs text-zinc-500 md:text-right">{key.fingerprint}</p>

                  <button
                    type="button"
                    onClick={() => void trackUserAction("SSH_KEY_DELETED", key.name, { fingerprint: key.fingerprint, type: key.type })}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-500/25 bg-red-500/[0.08] px-3 py-2 text-xs font-semibold text-red-300 transition hover:border-red-400/35 hover:bg-red-500/15 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/30"
                  >
                    <Trash size={13} />
                    Supprimer
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-zinc-800/80 bg-card/95 shadow-[0_18px_50px_rgba(0,0,0,0.22)]">
            <div className="flex items-center gap-2.5 border-b border-border bg-[#0d0d10] px-5 py-3.5">
              <KeyRound size={15} className="text-amber-400" />
              <h3 className="text-sm font-semibold">Ajouter une clé SSH</h3>
            </div>

            <div className="space-y-4 px-5 py-5">
              <label className="block">
                <span className="mb-2 block text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
                  Clé publique SSH
                </span>
                <textarea
                  rows={5}
                  placeholder="ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI..."
                  className="w-full resize-none rounded-lg border border-border bg-muted px-3 py-3 font-mono text-xs text-zinc-200 outline-none transition placeholder:text-zinc-500 focus:border-amber-500/45 focus:ring-1 focus:ring-amber-500/25"
                />
              </label>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[11px] leading-relaxed text-zinc-600">
                  Formats acceptés : ssh-rsa, ecdsa-sha2-nistp256, ssh-ed25519.
                </p>
                <button
                  type="button"
                  onClick={() => void trackUserAction("SSH_KEY_ADDED", "Clé SSH", { source: "ssh-security-view" })}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs font-semibold text-amber-300 transition hover:bg-amber-500/20 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/35"
                >
                  <KeyRound size={14} />
                  Ajouter la clé
                </button>
              </div>
            </div>
          </div>
        </section>

        <aside className="rounded-xl border border-zinc-800/80 bg-card/95 shadow-[0_18px_50px_rgba(0,0,0,0.22)] p-5">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-emerald-500/25 bg-emerald-500/10">
              <ShieldCheck size={17} className="text-emerald-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Statut des accès</h3>
              <p className="mt-0.5 text-xs font-mono text-zinc-500">
                Politique SSH appliquée aux agents
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setPasswordAccessDisabled((enabled) => !enabled);
              void trackUserAction("SETTINGS_UPDATED", "Politique SSH", { setting: "passwordAccessDisabled" });
            }}
            className="flex w-full items-center justify-between gap-4 rounded-lg border border-border bg-[#0d0d10] p-4 text-left transition hover:border-emerald-500/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/35"
            aria-pressed={passwordAccessDisabled}
          >
            <span>
              <span className="block text-sm font-medium text-zinc-100">
                Désactiver l'accès SSH par mot de passe
              </span>
              <span className="mt-1 block text-[11px] text-zinc-600">
                Priorité aux clés publiques autorisées
              </span>
            </span>
            <span
              className={`relative h-6 w-11 flex-shrink-0 rounded-full border transition ${
                passwordAccessDisabled
                  ? "border-emerald-500/50 bg-emerald-500/25"
                  : "border-zinc-700 bg-zinc-900"
              }`}
            >
              <span
                className={`absolute top-1 h-4 w-4 rounded-full transition ${
                  passwordAccessDisabled
                    ? "left-6 bg-emerald-300 shadow-lg shadow-emerald-500/25"
                    : "left-1 bg-zinc-600"
                }`}
              />
            </span>
          </button>

          <div className="mt-4 rounded-lg border border-zinc-800 bg-[#0d0d10] px-4 py-3">
            <p className="text-[11px] leading-relaxed text-zinc-500">
              Lorsque cette option est active, les tentatives SSH par mot de passe sont refusées sur les machines compatibles.
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}

// ── Paramètres view ───────────────────────────────────────────────────────────

const SETTINGS_TABS = [
  "Sécurité & Accès",
  "Serveurs Distants & Cloud",
  "Moteur d'IA",
  "Général",
] as const;

type SettingsTab = typeof SETTINGS_TABS[number];

const MONITORED_MACHINES = [
  {
    title: "Machine Locale (Kali OS)",
    status: "Connecté",
    statusColor: "bg-emerald-400",
    meta: "Agent local actif",
    icon: MonitorCog,
  },
  {
    title: "Instance Serveur Cloud (AWS EC2)",
    status: "Connecté",
    statusColor: "bg-emerald-400",
    meta: "IP : 54.210.43.5",
    icon: Cloud,
  },
  {
    title: "Serveur Distant (Production Node)",
    status: "Déconnecté",
    statusColor: "bg-zinc-500",
    meta: "Dernière activité : Il y a 2 heures",
    icon: Server,
  },
];

function SecurityAccessSettings() {
  const [mfaRequired, setMfaRequired] = useState(true);
  const [shortSessions, setShortSessions] = useState(true);
  const [profileAudit, setProfileAudit] = useState(true);

  const rules = [
    {
      label: "Double validation administrateur",
      detail: "Obligatoire pour les opérations sensibles",
      enabled: mfaRequired,
      setEnabled: setMfaRequired,
    },
    {
      label: "Sessions courtes pour consoles distantes",
      detail: "Expiration après 30 minutes d'inactivité",
      enabled: shortSessions,
      setEnabled: setShortSessions,
    },
    {
      label: "Journaliser les actions du profil",
      detail: "Trace les changements de mot de passe et les accès SSH",
      enabled: profileAudit,
      setEnabled: setProfileAudit,
    },
  ];

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <section className="overflow-hidden rounded-xl border border-zinc-800/80 bg-card/95 shadow-[0_18px_50px_rgba(0,0,0,0.22)]">
        <div className="flex items-center gap-2.5 border-b border-border bg-[#0d0d10] px-5 py-3.5">
          <ShieldCheck size={15} className="text-cyan-300" />
          <h3 className="text-sm font-semibold">Règles de sécurité administrateur</h3>
        </div>
        <div className="divide-y divide-border/40">
          {rules.map(({ label, detail, enabled, setEnabled }) => (
            <button
              key={label}
              type="button"
              onClick={() => {
                setEnabled((value) => !value);
                void trackUserAction("SETTINGS_UPDATED", label, { area: "security-access", enabled: !enabled });
              }}
              className="flex w-full items-center justify-between gap-5 px-5 py-4 text-left transition hover:bg-cyan-400/[0.06] hover:shadow-[inset_2px_0_0_rgba(59,130,246,0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/30"
              aria-pressed={enabled}
            >
              <span>
                <span className="block text-sm font-semibold text-zinc-100">{label}</span>
                <span className="mt-1 block text-xs font-mono text-zinc-500">{detail}</span>
              </span>
              <span
                className={`relative h-6 w-11 flex-shrink-0 rounded-full border transition ${
                  enabled ? "border-emerald-500/50 bg-emerald-500/25" : "border-zinc-700 bg-zinc-900"
                }`}
              >
                <span
                  className={`absolute top-1 h-4 w-4 rounded-full transition ${
                    enabled ? "left-6 bg-emerald-300 shadow-lg shadow-emerald-500/25" : "left-1 bg-zinc-600"
                  }`}
                />
              </span>
            </button>
          ))}
        </div>
      </section>

      <aside className="rounded-xl border border-zinc-800/80 bg-card/95 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.22)]">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
          État des règles
        </p>
        <div className="mt-4 space-y-3">
          {[
            ["Double validation", mfaRequired ? "Active" : "Inactive", mfaRequired ? "text-emerald-400" : "text-zinc-500"],
            ["Sessions courtes", shortSessions ? "Actives" : "Inactives", shortSessions ? "text-emerald-400" : "text-zinc-500"],
            ["Audit profil", profileAudit ? "Actif" : "Inactif", profileAudit ? "text-cyan-300" : "text-zinc-500"],
          ].map(([label, value, color]) => (
            <div key={label} className="flex items-center justify-between gap-4">
              <span className="text-[11px] text-zinc-600">{label}</span>
              <span className={`text-[11px] font-mono font-semibold ${color}`}>{value}</span>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}

function AuditAiSettings() {
  const [enabled, setEnabled] = useState(true);
  const [sensitivity, setSensitivity] = useState("Équilibré");

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="overflow-hidden rounded-xl border border-zinc-800/80 bg-card/95 shadow-[0_18px_50px_rgba(0,0,0,0.22)]">
        <div className="flex items-center gap-2.5 border-b border-border bg-[#0d0d10] px-5 py-3.5">
          <BrainCircuit size={15} className="text-violet-400" />
          <h3 className="text-sm font-semibold">Assistant IA pour l'audit</h3>
        </div>

        <div className="space-y-5 px-5 py-5">
          <button
            type="button"
            onClick={() => {
              setEnabled((value) => !value);
              void trackUserAction("SETTINGS_UPDATED", "Assistant IA", { enabled: !enabled });
            }}
            className="flex w-full items-center justify-between gap-4 rounded-lg border border-border bg-[#0d0d10] p-4 text-left transition hover:border-violet-500/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/35"
            aria-pressed={enabled}
          >
            <span>
              <span className="block text-sm font-medium text-zinc-100">
                Activer l'aide IA sur les journaux d'audit
              </span>
              <span className="mt-1 block text-[11px] text-zinc-500">
                Signale les comportements inhabituels dans l'historique des actions
              </span>
            </span>
            <span
              className={`relative h-6 w-11 flex-shrink-0 rounded-full border transition ${
                enabled ? "border-violet-500/50 bg-violet-500/30" : "border-zinc-700 bg-zinc-900"
              }`}
            >
              <span
                className={`absolute top-1 h-4 w-4 rounded-full transition ${
                  enabled ? "left-6 bg-violet-300 shadow-lg shadow-violet-500/30" : "left-1 bg-zinc-600"
                }`}
              />
            </span>
          </button>

          <label className="block">
            <span className="mb-2 block text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
              Sensibilité de détection
            </span>
            <select
              value={sensitivity}
              onChange={(event) => {
                setSensitivity(event.target.value);
                void trackUserAction("SETTINGS_UPDATED", "Sensibilité IA", { value: event.target.value });
              }}
              className="w-full appearance-none rounded-lg border border-border bg-muted px-3 py-3 text-xs text-zinc-200 outline-none transition focus:border-violet-500/45 focus:ring-1 focus:ring-violet-500/25"
            >
              <option>Conservateur</option>
              <option>Équilibré</option>
              <option>Agressif</option>
            </select>
          </label>
        </div>
      </section>

      <aside className="rounded-xl border border-zinc-800/80 bg-card/95 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.22)]">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
          Détections IA
        </p>
        <div className="mt-4 rounded-lg border border-zinc-800 bg-[#0d0d10] px-3 py-4">
          <p className="text-xs font-medium text-zinc-300">Aucune détection IA enregistrée</p>
          <p className="mt-1 text-[10px] font-mono text-zinc-600">
            Les détections réelles seront affichées lorsqu'un moteur d'analyse sera connecté.
          </p>
        </div>
      </aside>
    </div>
  );
}

function GeneralSettings() {
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [retentionDays, setRetentionDays] = useState("90 jours");

  return (
    <section className="overflow-hidden rounded-xl border border-zinc-800/80 bg-card/95 shadow-[0_18px_50px_rgba(0,0,0,0.22)]">
      <div className="flex items-center gap-2.5 border-b border-border bg-[#0d0d10] px-5 py-3.5">
        <Settings size={15} className="text-cyan-300" />
        <h3 className="text-sm font-semibold">Préférences générales d'audit</h3>
      </div>

      <div className="grid gap-5 px-5 py-5 md:grid-cols-2">
        <label className="block">
          <span className="mb-2 block text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
            Conservation des logs
          </span>
          <select
            value={retentionDays}
            onChange={(event) => {
              setRetentionDays(event.target.value);
              void trackUserAction("SETTINGS_UPDATED", "Conservation des logs", { value: event.target.value });
            }}
            className="w-full appearance-none rounded-lg border border-border bg-muted px-3 py-3 text-xs text-zinc-200 outline-none transition focus:border-cyan-400/45 focus:ring-1 focus:ring-cyan-400/25"
          >
            <option>30 jours</option>
            <option>90 jours</option>
            <option>180 jours</option>
            <option>365 jours</option>
          </select>
        </label>

        <button
          type="button"
          onClick={() => {
            setAutoRefresh((value) => !value);
            void trackUserAction("SETTINGS_UPDATED", "Actualisation automatique", { enabled: !autoRefresh });
          }}
          className="flex items-center justify-between gap-4 rounded-lg border border-border bg-[#0d0d10] p-4 text-left transition hover:border-cyan-400/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/30"
          aria-pressed={autoRefresh}
        >
          <span>
            <span className="block text-sm font-medium text-zinc-100">Actualisation automatique</span>
            <span className="mt-1 block text-[11px] text-zinc-500">Rafraîchit les flux d'audit en arrière-plan</span>
          </span>
          <span
            className={`relative h-6 w-11 flex-shrink-0 rounded-full border transition ${
              autoRefresh ? "border-cyan-400/50 bg-cyan-400/25" : "border-zinc-700 bg-zinc-900"
            }`}
          >
            <span
              className={`absolute top-1 h-4 w-4 rounded-full transition ${
                autoRefresh ? "left-6 bg-cyan-200 shadow-lg shadow-cyan-400/25" : "left-1 bg-zinc-600"
              }`}
            />
          </span>
        </button>
      </div>
    </section>
  );
}

function ParametresView() {
  const [activeSettingsTab, setActiveSettingsTab] = useState<SettingsTab>("Serveurs Distants & Cloud");
  const maskedToken = "mel_agt_sk_••••••••••••••••••••••••••••••••";

  return (
    <main
      className="flex-1 overflow-y-auto px-4 py-5 md:px-6"
      style={{ scrollbarWidth: "none" } as React.CSSProperties}
    >
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-cyan-500/30 bg-cyan-500/20">
            <Settings size={15} className="text-cyan-300" />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-zinc-100">Configurations & Paramètres</h2>
            <p className="mt-0.5 text-xs font-mono text-zinc-500">
              Gestion des agents, accès distants et aide IA à l'audit
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-zinc-800/80 bg-card/95 shadow-[0_18px_50px_rgba(0,0,0,0.22)] p-1">
          {SETTINGS_TABS.map((tab) => {
            const active = tab === activeSettingsTab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveSettingsTab(tab)}
                className={`rounded-md px-3 py-2 text-xs font-medium transition-all ${
                  active
                    ? "bg-cyan-500/20 text-cyan-200 shadow-inner shadow-cyan-950/40"
                    : "text-zinc-600 hover:bg-white/5 hover:text-zinc-300"
                }`}
              >
                {tab}
              </button>
            );
          })}
        </div>
      </div>

      {activeSettingsTab === "Serveurs Distants & Cloud" ? (
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <section className="space-y-5">
          <div className="overflow-hidden rounded-xl border border-zinc-800/80 bg-card/95 shadow-[0_18px_50px_rgba(0,0,0,0.22)]">
            <div className="flex items-center justify-between border-b border-border bg-[#0d0d10] px-5 py-3.5">
              <div className="flex items-center gap-2.5">
                <KeyRound size={15} className="text-cyan-300" />
                <h3 className="text-sm font-semibold">Clés d'API d'Ingestion</h3>
              </div>
              <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-mono font-semibold text-emerald-400">
                Rotation active
              </span>
            </div>

            <div className="space-y-4 px-5 py-5">
              <label className="block">
                <span className="mb-2 block text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
                  Token d'authentification pour Agents Distants
                </span>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <div className="relative flex-1">
                    <input
                      readOnly
                      type="text"
                      value={maskedToken}
                      className="w-full rounded-lg border border-border bg-[#0b0d12] px-3 py-3 pr-11 font-mono text-xs text-zinc-200 outline-none ring-1 ring-inset ring-white/[0.03] transition selection:bg-amber-500/20 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30"
                    />
                    <Shield size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600" />
                  </div>
                  <button
                    type="button"
                    onClick={() => void trackUserAction("SETTINGS_UPDATED", "Token agent copié", { target: "agent-token" })}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-700 px-3 py-3 text-xs font-semibold text-zinc-300 transition hover:border-cyan-400/50 hover:bg-cyan-400/10 hover:text-cyan-200"
                    title="Copier le token"
                  >
                    <Copy size={14} />
                    Copier
                  </button>
                  <button
                    type="button"
                    onClick={() => void trackUserAction("SETTINGS_UPDATED", "Token agent régénéré", { target: "agent-token" })}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-3 text-xs font-semibold text-amber-300 transition hover:bg-amber-500/20 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/35"
                  >
                    <RotateCw size={14} />
                    Régénérer
                  </button>
                </div>
              </label>

              <p className="text-[11px] leading-relaxed text-zinc-600">
                Utilisez ce jeton uniquement sur les agents approuvés. Toute régénération invalide les anciennes connexions distantes.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800/80 bg-card/95 shadow-[0_18px_50px_rgba(0,0,0,0.22)] p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold">Liste des Machines Surveillées</h3>
                <p className="mt-0.5 text-xs font-mono text-zinc-500">
                  Agents connectés au collecteur central
                </p>
              </div>
              <span className="rounded-full bg-cyan-500/10 px-2.5 py-1 text-[10px] font-mono font-semibold text-cyan-300">
                3 machines
              </span>
            </div>

            <div className="grid gap-3 lg:grid-cols-3">
              {MONITORED_MACHINES.map(({ title, status, statusColor, meta, icon: Icon }) => {
                const connected = status === "Connecté";
                return (
                  <article
                    key={title}
                    className={`rounded-lg border border-zinc-800/80 bg-[#0d0f14] p-4 transition ${
                      connected
                        ? "hover:border-emerald-500/25 hover:bg-emerald-500/[0.025]"
                        : "opacity-85 hover:border-zinc-600"
                    }`}
                  >
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-cyan-500/20 bg-cyan-500/10">
                        <Icon size={17} className="text-cyan-300" />
                      </div>
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-800 px-2 py-1 text-[10px] font-mono text-zinc-400">
                        <span className={`h-1.5 w-1.5 rounded-full ${statusColor}`} />
                        {status}
                      </span>
                    </div>
                    <h4 className="text-sm font-semibold leading-snug text-zinc-100">{title}</h4>
                    <p className="mt-2 text-xs font-mono text-zinc-500">{meta}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <aside className="space-y-5">
          <div className="rounded-lg border border-border bg-[#0d0d10] p-5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
              État d'ingestion
            </p>
            <div className="mt-4 space-y-3">
              {[
                ["Collecteur central", "Synchronisé", "text-emerald-400"],
                ["File d'ingestion", "Stable", "text-cyan-300"],
                ["Agents hors ligne", "1 signalé", "text-zinc-500"],
              ].map(([label, value, color]) => (
                <div key={label} className="flex items-center justify-between gap-4">
                  <span className="text-[11px] text-zinc-600">{label}</span>
                  <span className={`text-[11px] font-mono font-semibold ${color}`}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
      ) : activeSettingsTab === "Sécurité & Accès" ? (
        <SecurityAccessSettings />
      ) : activeSettingsTab === "Moteur d'IA" ? (
        <AuditAiSettings />
      ) : (
        <GeneralSettings />
      )}
    </main>
  );
}

// ── Root ───────────────────────────────────────────────────────────────────────

export default function Dashboard({ onLogout }: { onLogout: () => void }) {
  const [activeNav, setActiveNav] = useState<NavId>("dashboard");
  const currentUser = getCurrentUser();
  const [playing,   setPlaying]   = useState(true);
  const [logs,      setLogs]      = useState<AuditLog[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [journalctlBusy, setJournalctlBusy] = useState(false);
  const [journalctlStatus, setJournalctlStatus] = useState<JournalctlLiveStatus | null>(null);
  const [error,     setError]     = useState<string | null>(null);
  const [query,     setQuery]     = useState<Required<Pick<AuditLogQuery, "page" | "limit">> & Omit<AuditLogQuery, "page" | "limit">>({
    page: 1,
    limit: 20,
    search: "",
    severity: "",
    human_severity: "",
    category: "",
    event_type: "",
    source_type: "",
    service: "",
    username: "",
    command: "",
    working_directory: "",
    date_from: "",
    date_to: "",
  });
  const [pagination, setPagination] = useState<AuditLogPagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });
  const didMountRef = useRef(false);

  useEffect(() => { document.documentElement.classList.add("dark"); }, []);

  const loadLogs = useCallback(async (nextQuery: typeof query) => {
    setLoading(true);
    setError(null);

    try {
      const hasSearch = Boolean(nextQuery.search?.trim());
      const hasFilters = Boolean(
        nextQuery.severity
        || nextQuery.human_severity
        || nextQuery.category
        || nextQuery.event_type
        || nextQuery.source_type
        || nextQuery.service
        || nextQuery.username
        || nextQuery.command
        || nextQuery.working_directory
        || nextQuery.date_from
        || nextQuery.date_to
      );
      const response = hasSearch
        ? await searchAuditLogs(nextQuery.search ?? "", nextQuery)
        : hasFilters
        ? await filterAuditLogs(nextQuery)
        : await getAuditLogs(nextQuery);

      setLogs(response.data);
      setPagination(response.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de charger les logs d'audit");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadLogs(query);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadLogs, query]);

  useEffect(() => {
    const socket = connectAuditLogSocket((log) => {
      if (!playing || query.page !== 1) return;

      setLogs((current) => {
        if (current.some((item) => item.id === log.id)) return current;
        return [log, ...current].slice(0, 100);
      });
      setPagination((current) => ({ ...current, total: current.total + 1 }));
    });

    return () => {
      socket.disconnect();
    };
  }, [playing, query.page, query.limit]);

  useEffect(() => {
    void getJournalctlLiveStatus()
      .then(setJournalctlStatus)
      .catch(() => {
        setJournalctlStatus(null);
      });
  }, []);

  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }

    void trackUserAction("NAVIGATE", NAV_LABELS[activeNav], { section: activeNav });
  }, [activeNav]);

  const handleClear = useCallback(() => {
    setLogs([]);
    void trackUserAction("CLEAR_LIVE_FEED", "Historique Live");
  }, []);

  const handleToggleJournalctlLive = useCallback(async () => {
    setJournalctlBusy(true);
    setError(null);

    try {
      const nextStatus = journalctlStatus?.running
        ? await stopJournalctlLive()
        : await startJournalctlLive();
      setJournalctlStatus(nextStatus);
      await loadLogs({ ...query, page: 1 });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action journalctl -f impossible");
    } finally {
      setJournalctlBusy(false);
    }
  }, [journalctlStatus?.running, loadLogs, query]);

  const handleQueryChange = useCallback((nextQuery: AuditLogQuery) => {
    setQuery((current) => ({
      ...current,
      ...nextQuery,
      page: nextQuery.page ?? current.page,
      limit: nextQuery.limit ?? current.limit,
    }));
  }, []);

  const nav = (id: NavId) => {
    if (id === "administration" && !isAdminRole(currentUser?.role)) return;
    setActiveNav(id);
  };

  return (
    <Shell active={activeNav} onNav={nav} onLogout={onLogout} canUseAdmin={isAdminRole(currentUser?.role)}>
      {activeNav === "live" ? (
        <HistoriqueLiveView
          logs={logs}
          pagination={pagination}
          query={query}
          loading={loading}
          error={error}
          playing={playing}
          setPlaying={setPlaying}
          onQueryChange={handleQueryChange}
          onClear={handleClear}
          onToggleJournalctlLive={handleToggleJournalctlLive}
          journalctlStatus={journalctlStatus}
          journalctlBusy={journalctlBusy}
        />
      ) : activeNav === "dashboard" ? (
        <DashboardView logs={logs} loading={loading} error={error} playing={playing} setPlaying={setPlaying} />
      ) : activeNav === "rapports" ? (
        <RapportsView />
      ) : activeNav === "parametres" ? (
        <ParametresView />
      ) : activeNav === "profil" ? (
        <ProfilView />
      ) : activeNav === "sessions" ? (
        <SessionsView />
      ) : activeNav === "administration" ? (
        <AdministrationView />
      ) : activeNav === "ssh" ? (
        <SshSecurityView />
      ) : (
        <main className="flex-1 flex flex-col items-center justify-center text-zinc-500">
          <Terminal size={36} className="mb-3 opacity-20" />
          <p className="text-sm font-mono">Section en cours de développement</p>
        </main>
      )}
    </Shell>
  );
}
