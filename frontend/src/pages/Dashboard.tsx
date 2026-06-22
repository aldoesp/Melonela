import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  LayoutDashboard, Activity, BarChart2, FileText, Settings,
  Search, Bell, Shield, ChevronDown, ChevronRight, Play, Pause,
  Download, TrendingUp, TrendingDown, Server, AlertTriangle,
  XCircle, LogIn, LogOut, Trash2, Filter, Terminal, Wifi, Hash,
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

// ── Types ──────────────────────────────────────────────────────────────────────

type Severity = "CRITIQUE" | "AVERTISSEMENT" | "INFO";
type NavId = "dashboard" | "live" | "rapports" | "parametres" | "profil" | "sessions" | "ssh";

interface LogEntry {
  id: number;
  heure: string;
  service: string;
  utilisateur: string;
  action: string;
  dangerosite: Severity;
  ipSource: string;
  details: {
    metadata?: Record<string, unknown>;
    erreur?: Record<string, unknown>;
    reseau?: Record<string, unknown>;
    [k: string]: unknown;
  };
}

// ── Palette ────────────────────────────────────────────────────────────────────

const C = { info: "#10b981", warn: "#f59e0b", crit: "#ef4444" };

const SEV: Record<Severity, { pill: string; text: string; dot: string }> = {
  CRITIQUE:      { pill: "bg-red-500/15 text-red-400",         text: "text-red-400",     dot: "bg-red-500"     },
  AVERTISSEMENT: { pill: "bg-amber-500/15 text-amber-400",     text: "text-amber-400",   dot: "bg-amber-500"   },
  INFO:          { pill: "bg-emerald-500/15 text-emerald-400", text: "text-emerald-400", dot: "bg-emerald-400" },
};

const NAV_ITEMS: { id: NavId; icon: React.ElementType; label: string }[] = [
  { id: "dashboard",  icon: LayoutDashboard, label: "Tableau de bord"  },
  { id: "live",       icon: Activity,        label: "Historique Live"  },
  { id: "rapports",   icon: FileText,        label: "Rapports"         },
  { id: "parametres", icon: Settings,        label: "Paramètres"       },
];

// ── Static chart data ──────────────────────────────────────────────────────────

const AREA_DATA = [
  { h: "00h", i: 320,  a: 45,  c: 2  }, { h: "01h", i: 210,  a: 30,  c: 1  },
  { h: "02h", i: 180,  a: 22,  c: 0  }, { h: "03h", i: 150,  a: 18,  c: 3  },
  { h: "04h", i: 190,  a: 25,  c: 1  }, { h: "05h", i: 260,  a: 38,  c: 0  },
  { h: "06h", i: 480,  a: 62,  c: 4  }, { h: "07h", i: 720,  a: 95,  c: 2  },
  { h: "08h", i: 1050, a: 140, c: 5  }, { h: "09h", i: 1380, a: 182, c: 8  },
  { h: "10h", i: 1520, a: 205, c: 6  }, { h: "11h", i: 1640, a: 220, c: 11 },
  { h: "12h", i: 1580, a: 198, c: 9  }, { h: "13h", i: 1420, a: 175, c: 7  },
  { h: "14h", i: 1350, a: 168, c: 5  }, { h: "15h", i: 1490, a: 192, c: 8  },
  { h: "16h", i: 1620, a: 218, c: 12 }, { h: "17h", i: 1780, a: 245, c: 14 },
  { h: "18h", i: 1540, a: 210, c: 10 }, { h: "19h", i: 980,  a: 135, c: 6  },
  { h: "20h", i: 740,  a: 98,  c: 4  }, { h: "21h", i: 560,  a: 72,  c: 3  },
  { h: "22h", i: 420,  a: 55,  c: 2  }, { h: "23h", i: 350,  a: 48,  c: 1  },
];

const DONUT_DATA = [
  { name: "Info",          value: 89240, color: C.info },
  { name: "Avertissement", value: 8812,  color: C.warn },
  { name: "Critique",      value: 456,   color: C.crit },
];

// ── Seed logs ──────────────────────────────────────────────────────────────────

const SEED: LogEntry[] = [
  {
    id: 1, heure: "19:40:02", service: "sshd.service", utilisateur: "root",
    action: "Échec Connexion", dangerosite: "CRITIQUE", ipSource: "192.168.1.50",
    details: {
      metadata: { pid: 4821, port: 22, tentatives: 8, protocole: "SSH-2.0", duree_ms: 312 },
      erreur:   { code: "AUTH_FAILURE", message: "Failed password for root from 192.168.1.50 port 52314 ssh2", type: "PermissionDenied" },
      reseau:   { mac_source: "00:1A:2B:3C:4D:5E", interface: "eth0", vlan: 10, ttl: 64 },
    },
  },
  {
    id: 2, heure: "19:38:15", service: "systemd-logind", utilisateur: "aldoesp",
    action: "Session Ouverte", dangerosite: "INFO", ipSource: "Local",
    details: {
      metadata: { session_id: "c12", uid: 1000, gid: 1000, tty: "pts/0" },
      erreur:   null,
      reseau:   { mac_source: "N/A", interface: "lo", vlan: null, ttl: null },
    },
  },
  {
    id: 3, heure: "19:35:40", service: "sudo", utilisateur: "aldoesp",
    action: "apt update", dangerosite: "AVERTISSEMENT", ipSource: "Local",
    details: {
      metadata: { commande: "/usr/bin/apt update", tty: "pts/0", pwd: "/home/aldoesp", env: "LANG=fr_FR.UTF-8" },
      erreur:   null,
      reseau:   { mac_source: "N/A", interface: "lo", vlan: null, ttl: null },
    },
  },
  {
    id: 4, heure: "19:31:10", service: "nginx", utilisateur: "www-data",
    action: "Requête 403", dangerosite: "AVERTISSEMENT", ipSource: "203.0.113.42",
    details: {
      metadata: { methode: "GET", uri: "/admin/.env", status: 403, user_agent: "python-requests/2.28.0" },
      erreur:   { code: "FORBIDDEN", message: "Access denied to protected resource", type: "AuthorizationError" },
      reseau:   { mac_source: "AA:BB:CC:DD:EE:FF", interface: "eth1", vlan: 20, ttl: 52 },
    },
  },
  {
    id: 5, heure: "19:28:55", service: "auditd", utilisateur: "root",
    action: "Règle Audit Modifiée", dangerosite: "CRITIQUE", ipSource: "Local",
    details: {
      metadata: { op: "add_rule", key: "privileged", syscall: "execve", filter: "exit", action: "always" },
      erreur:   { code: "RULE_CHANGE", message: "Audit rule modification detected on privileged syscall", type: "SecurityEvent" },
      reseau:   { mac_source: "N/A", interface: "lo", vlan: null, ttl: null },
    },
  },
  {
    id: 6, heure: "19:24:18", service: "cron", utilisateur: "backup_usr",
    action: "Tâche Exécutée", dangerosite: "INFO", ipSource: "Local",
    details: {
      metadata: { job: "/usr/local/bin/backup.sh", exit_code: 0, duree_ms: 4821, pid: 9912 },
      erreur:   null,
      reseau:   { mac_source: "N/A", interface: "lo", vlan: null, ttl: null },
    },
  },
  {
    id: 7, heure: "19:20:33", service: "kernel", utilisateur: "root",
    action: "Module Chargé", dangerosite: "AVERTISSEMENT", ipSource: "Local",
    details: {
      metadata: { module: "nf_conntrack", version: "5.15.0-91-generic", vermagic: "5.15.0-91-generic SMP", taint: false },
      erreur:   null,
      reseau:   { mac_source: "N/A", interface: "lo", vlan: null, ttl: null },
    },
  },
  {
    id: 8, heure: "19:15:07", service: "firewalld", utilisateur: "root",
    action: "Règle DROP", dangerosite: "CRITIQUE", ipSource: "203.0.113.88",
    details: {
      metadata: { proto: "TCP", dpt: 3306, src: "203.0.113.88", dst: "10.0.0.5", flags: "SYN", packets: 1 },
      erreur:   { code: "PACKET_DROP", message: "Inbound TCP connection dropped by firewall policy", type: "NetworkBlock" },
      reseau:   { mac_source: "DE:AD:BE:EF:00:11", interface: "eth0", vlan: 30, ttl: 47 },
    },
  },
  {
    id: 9, heure: "19:12:44", service: "fail2ban", utilisateur: "root",
    action: "IP Bannie", dangerosite: "CRITIQUE", ipSource: "198.51.100.14",
    details: {
      metadata: { ip: "198.51.100.14", jail: "sshd", duree_ban: "3600s", tentatives: 10 },
      erreur:   { code: "IP_BANNED", message: "IP banned after 10 failed attempts in sshd jail", type: "BruteForce" },
      reseau:   { mac_source: "FF:EE:DD:CC:BB:AA", interface: "eth0", vlan: 10, ttl: 58 },
    },
  },
  {
    id: 10, heure: "19:08:31", service: "postgresql", utilisateur: "postgres",
    action: "Connexion Refusée", dangerosite: "AVERTISSEMENT", ipSource: "10.0.0.25",
    details: {
      metadata: { database: "prod_db", port: 5432, ssl: true, pg_version: "15.2" },
      erreur:   { code: "28P01", message: "password authentication failed for user \"api_user\"", type: "AuthError" },
      reseau:   { mac_source: "11:22:33:44:55:66", interface: "eth1", vlan: 40, ttl: 64 },
    },
  },
  {
    id: 11, heure: "19:05:19", service: "sshd.service", utilisateur: "deploy",
    action: "Connexion Réussie", dangerosite: "INFO", ipSource: "192.168.1.12",
    details: {
      metadata: { pid: 5102, port: 22, methode: "publickey", fingerprint: "SHA256:abc123xyz" },
      erreur:   null,
      reseau:   { mac_source: "AA:11:BB:22:CC:33", interface: "eth0", vlan: 10, ttl: 64 },
    },
  },
  {
    id: 12, heure: "19:01:05", service: "sudo", utilisateur: "sysadmin",
    action: "systemctl restart", dangerosite: "AVERTISSEMENT", ipSource: "Local",
    details: {
      metadata: { commande: "systemctl restart nginx.service", tty: "pts/1", pwd: "/root", exit_code: 0 },
      erreur:   null,
      reseau:   { mac_source: "N/A", interface: "lo", vlan: null, ttl: null },
    },
  },
];

const LIVE_POOL: Omit<LogEntry, "id" | "heure">[] = [
  { service: "sshd.service",   utilisateur: "unknown",    action: "Échec Connexion",       dangerosite: "CRITIQUE",      ipSource: "198.51.100.14", details: { metadata: { tentatives: 3, port: 22 },                reseau: { mac_source: "CC:DD:EE:FF:00:11", interface: "eth0", vlan: 10, ttl: 55 } } },
  { service: "systemd-logind", utilisateur: "aldoesp",    action: "Session Fermée",        dangerosite: "INFO",          ipSource: "Local",         details: { metadata: { session_id: "c13", duree: "0:42:11" },    reseau: { mac_source: "N/A", interface: "lo", vlan: null, ttl: null } } },
  { service: "nginx",          utilisateur: "www-data",   action: "Requête 200",           dangerosite: "INFO",          ipSource: "10.0.0.25",     details: { metadata: { uri: "/api/status", status: 200 },        reseau: { mac_source: "11:22:33:44:55:66", interface: "eth1", vlan: 40, ttl: 64 } } },
  { service: "sudo",           utilisateur: "deploy",     action: "systemctl restart",     dangerosite: "AVERTISSEMENT", ipSource: "Local",         details: { metadata: { commande: "systemctl restart app.service" }, reseau: { mac_source: "N/A", interface: "lo", vlan: null, ttl: null } } },
  { service: "fail2ban",       utilisateur: "root",       action: "Scan Port Détecté",     dangerosite: "CRITIQUE",      ipSource: "203.0.113.77",  details: { metadata: { ports_scannes: 1024, duree_ms: 800 },     reseau: { mac_source: "DE:AD:00:00:BE:EF", interface: "eth0", vlan: 10, ttl: 47 }, erreur: { code: "PORT_SCAN", message: "Mass port scan detected from external host", type: "Reconnaissance" } } },
  { service: "auditd",         utilisateur: "root",       action: "Accès Fichier Sensible",dangerosite: "CRITIQUE",      ipSource: "Local",         details: { metadata: { fichier: "/etc/shadow", op: "read", pid: 7810 }, erreur: { code: "SENSITIVE_READ", message: "Unauthorized read access to /etc/shadow", type: "PrivilegeEscalation" }, reseau: { mac_source: "N/A", interface: "lo", vlan: null, ttl: null } } },
  { service: "cron",           utilisateur: "backup_usr", action: "Tâche Démarrée",        dangerosite: "INFO",          ipSource: "Local",         details: { metadata: { job: "/usr/local/bin/sync.sh", pid: 10091 }, reseau: { mac_source: "N/A", interface: "lo", vlan: null, ttl: null } } },
];

let _idCtr = SEED.length + 1;
function mkLiveLog(): LogEntry {
  const t = LIVE_POOL[Math.floor(Math.random() * LIVE_POOL.length)];
  const n = new Date();
  return { ...t, id: _idCtr++, heure: `${String(n.getHours()).padStart(2,"0")}:${String(n.getMinutes()).padStart(2,"0")}:${String(n.getSeconds()).padStart(2,"0")}` };
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
  children,
}: {
  active: NavId;
  onNav: (id: NavId) => void;
  onLogout: () => void;
  children: React.ReactNode;
}) {
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const date = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  const profileItems: { label: string; icon: React.ElementType; nav?: NavId }[] = [
    { label: "Mon Profil", icon: UserCog, nav: "profil" },
    { label: "Journal de mes connexions", icon: History, nav: "sessions" },
    { label: "Sécurité & Clés SSH", icon: ShieldCheck, nav: "ssh" },
  ];

  return (
    <div className="h-screen w-screen flex overflow-hidden bg-background text-foreground" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* Sidebar */}
      <aside className="hidden w-60 flex-shrink-0 flex-col border-r border-border bg-[#0d0d10] md:flex">
        <div className="flex items-center gap-2.5 px-5 py-4 border-b border-border">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
            <Shield size={15} className="text-white" />
          </div>
          <span className="text-sm font-bold tracking-wide">Melonela</span>
          <span className="ml-auto text-[9px] font-mono bg-blue-600/20 text-blue-400 px-1.5 py-0.5 rounded">SIEM</span>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {NAV_ITEMS.map(({ id, icon: Icon, label }) => {
            const on = active === id;
            return (
              <button key={id} onClick={() => onNav(id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 ${on ? "bg-blue-600/15 text-blue-400 font-medium" : "text-zinc-500 hover:text-zinc-200 hover:bg-white/5"}`}>
                <Icon size={15} />
                {label}
                {on && <ChevronRight size={11} className="ml-auto text-blue-500" />}
              </button>
            );
          })}
        </nav>
        <div className="relative border-t border-border p-4">
          {profileMenuOpen && (
            <div className="absolute bottom-[76px] left-3 z-50 w-[260px] rounded-xl border border-zinc-700/70 bg-[#0c0c0e]/95 p-2 shadow-[0_24px_80px_rgba(0,0,0,0.72)] ring-1 ring-white/[0.06] backdrop-blur-xl transition duration-150">
              <div className="px-3 py-2.5">
                <p className="text-sm font-bold leading-tight text-zinc-100">Aldo Esp</p>
                <p className="mt-0.5 truncate text-[11px] font-mono text-zinc-500">
                  ID: aldoesp (Administrateur)
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
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-xs font-medium text-zinc-400 transition hover:bg-blue-500/[0.08] hover:text-zinc-100 hover:shadow-[inset_2px_0_0_rgba(59,130,246,0.45)]"
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
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">AE</div>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-zinc-100">aldoesp</p>
              <p className="truncate text-[10px] text-zinc-500">Administrateur</p>
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
        <header className="flex-shrink-0 flex flex-wrap items-center gap-3 px-4 py-3 border-b border-border bg-[#0a0a0d] md:flex-nowrap md:gap-4 md:px-6">
          <h1 className="text-sm font-bold whitespace-nowrap">Dashboard Audit Système</h1>
          <div className="order-3 w-full flex-1 relative md:order-none md:max-w-lg">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
            <input type="text" placeholder="Rechercher une IP, un utilisateur, un service..."
              className="w-full bg-muted border border-border rounded-lg pl-8 pr-4 py-2 text-xs placeholder:text-zinc-600 focus:outline-none focus:border-blue-600/50 focus:ring-1 focus:ring-blue-600/30 transition-all" />
          </div>
          <div className="ml-auto flex items-center gap-4">
            <div className="hidden items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-3 py-1.5 lg:flex">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] font-medium text-emerald-400 whitespace-nowrap">Serveur Central: En Ligne</span>
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
        <nav className="flex flex-shrink-0 gap-2 overflow-x-auto border-b border-border bg-[#0d0d10] px-3 py-2 md:hidden">
          {NAV_ITEMS.map(({ id, icon: Icon, label }) => {
            const on = active === id;
            return (
              <button
                key={id}
                onClick={() => onNav(id)}
                className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-xs transition ${
                  on ? "bg-blue-600/15 text-blue-300" : "text-zinc-500"
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

function DashboardView({ logs, playing, setPlaying }: { logs: LogEntry[]; playing: boolean; setPlaying: (v: boolean | ((p: boolean) => boolean)) => void }) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const total = DONUT_DATA.reduce((s, d) => s + d.value, 0);

  return (
    <main className="flex-1 overflow-y-auto px-6 py-5 space-y-4" style={{ scrollbarWidth: "none" } as React.CSSProperties}>
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Total Logs (24h)"      value="142 508"      icon={BarChart2}     bg="bg-blue-600"  trend="up"   sub="Depuis minuit" />
        <KpiCard title="Connexions Échouées"   value="1 240"        icon={XCircle}       bg="bg-amber-500" vc="text-amber-400"   trend="up"   sub="+18% vs. hier" />
        <KpiCard title="Alertes Critiques"     value="14"           icon={AlertTriangle} bg="bg-red-600"   vc="text-red-400"     trend="down" sub="2 non résolues" />
        <KpiCard title="Serveurs Distants"     value="3 / 4 Actifs" icon={Server}        bg="bg-zinc-600"  sub="srv-04 hors ligne" />
      </section>

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
            <AreaChart data={AREA_DATA} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
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
                  data={DONUT_DATA}
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={78}
                  paddingAngle={2}
                  dataKey="value"
                  startAngle={90}
                  endAngle={-270}
                >
                  {DONUT_DATA.map((d) => (
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
            {DONUT_DATA.map((d) => (
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
            <Activity size={14} className="text-blue-400" />
            <h2 className="text-sm font-semibold">Historique des Actions (Temps Réel)</h2>
            {playing && <><span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse ml-2" /><span className="text-[10px] font-mono text-red-400 font-semibold">LIVE</span></>}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setPlaying((p) => !p)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${playing ? "bg-red-500/10 border-red-500/25 text-red-400 hover:bg-red-500/20" : "bg-emerald-500/10 border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/20"}`}>
              {playing ? <Pause size={11} /> : <Play size={11} />}{playing ? "Pause" : "Reprendre"}
            </button>
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600/10 border border-blue-600/25 text-blue-400 hover:bg-blue-600/20 transition-all">
              <Download size={11} />Exporter (CSV/PDF)
            </button>
          </div>
        </div>
        <div className="grid gap-2 px-5 py-2.5 border-b border-border bg-muted/40 text-[10px] font-semibold text-zinc-600 uppercase tracking-wider"
          style={{ gridTemplateColumns: "90px 155px 115px 1fr 145px 125px 32px" }}>
          <span>Heure</span><span>Service</span><span>Utilisateur</span><span>Action</span><span>Dangerosité</span><span>IP Source</span><span />
        </div>
        <div className="overflow-y-auto max-h-64" style={{ scrollbarWidth: "none" } as React.CSSProperties}>
          {logs.map((log, idx) => (
            <div key={log.id}>
              <button onClick={() => setExpanded((p) => p === log.id ? null : log.id)}
                className={`w-full grid gap-2 px-5 py-2.5 text-left text-xs border-b border-border/40 transition-colors group ${idx % 2 === 0 ? "bg-card" : "bg-muted/10"} hover:bg-blue-600/5`}
                style={{ gridTemplateColumns: "90px 155px 115px 1fr 145px 125px 32px" }}>
                <span className="font-mono text-zinc-500 tabular-nums text-[11px]">{log.heure}</span>
                <span className="text-zinc-400 truncate font-mono text-[11px]">{log.service}</span>
                <span className="text-zinc-300 flex items-center gap-1.5 truncate"><LogIn size={10} className="text-zinc-600 flex-shrink-0" />{log.utilisateur}</span>
                <span className="text-zinc-200 truncate">{log.action}</span>
                <span><Badge level={log.dangerosite} /></span>
                <span className="font-mono text-zinc-500 text-[11px]">{log.ipSource}</span>
                <span className="flex items-center justify-center">
                  <ChevronDown size={13} className={`text-zinc-500 group-hover:text-zinc-400 transition-transform duration-200 ${expanded === log.id ? "rotate-180 text-blue-400" : ""}`} />
                </span>
              </button>
              <div className="overflow-hidden transition-all duration-300" style={{ maxHeight: expanded === log.id ? "200px" : "0px" }}>
                <div className="px-5 py-3 bg-zinc-950/90 border-b border-border">
                  <JsonBlock data={{ heure: log.heure, service: log.service, utilisateur: log.utilisateur, action: log.action, dangerosite: log.dangerosite, ip_source: log.ipSource, ...log.details }} />
                </div>
              </div>
            </div>
          ))}
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

const ALL_SERVICES   = ["Tous les services", "sshd.service", "systemd-logind", "sudo", "nginx", "auditd", "cron", "kernel", "firewalld", "fail2ban", "postgresql"];
const ALL_SEVERITIES = ["Toutes", "CRITIQUE", "AVERTISSEMENT", "INFO"] as const;
const ALL_IPS        = ["Toutes les IPs", "192.168.1.50", "192.168.1.12", "10.0.0.25", "203.0.113.42", "203.0.113.77", "198.51.100.14", "Local"];

const COL = "44px 92px 158px 112px 1fr 148px 120px 36px";

function HistoriqueLiveView({ logs, playing, setPlaying, onClear }: {
  logs: LogEntry[];
  playing: boolean;
  setPlaying: (v: boolean | ((p: boolean) => boolean)) => void;
  onClear: () => void;
}) {
  // Row 5 (nginx 403) pre-expanded — its JSON showcases metadata + erreur + reseau + mac
  const [expanded, setExpanded] = useState<number | null>(5);
  const [autoScroll, setAutoScroll] = useState(true);
  const [blink, setBlink]           = useState(true);
  const [svcFilter, setSvcFilter]   = useState("Tous les services");
  const [sevFilter, setSevFilter]   = useState<typeof ALL_SEVERITIES[number]>("Toutes");
  const [ipFilter,  setIpFilter]    = useState("Toutes les IPs");
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

  const filtered = useMemo(() => logs.filter((l) => {
    if (svcFilter !== "Tous les services" && l.service    !== svcFilter)    return false;
    if (sevFilter !== "Toutes"           && l.dangerosite !== sevFilter)    return false;
    if (ipFilter  !== "Toutes les IPs"   && l.ipSource    !== ipFilter)     return false;
    return true;
  }), [logs, svcFilter, sevFilter, ipFilter]);

  const shown = filtered.slice(0, 50);
  const critN = shown.filter((l) => l.dangerosite === "CRITIQUE").length;
  const warnN = shown.filter((l) => l.dangerosite === "AVERTISSEMENT").length;
  const infoN = shown.filter((l) => l.dangerosite === "INFO").length;
  const hasFilter = svcFilter !== "Tous les services" || sevFilter !== "Toutes" || ipFilter !== "Toutes les IPs";

  return (
    <main className="flex-1 flex flex-col overflow-hidden px-6 py-5 gap-3">

      {/* ── Title + controls ── */}
      <div className="flex items-center gap-3 flex-wrap flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-blue-600/20 border border-blue-600/30 flex items-center justify-center">
            <Terminal size={14} className="text-blue-400" />
          </div>
          <h2 className="text-lg font-semibold tracking-tight text-zinc-100">Flux d'Audit en Temps Réel</h2>
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
          <Trash2 size={12} />Vider l'écran
        </button>

        <div className="ml-auto flex items-center gap-2">
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600/10 border border-blue-600/25 text-blue-400 hover:bg-blue-600/20 transition-all">
            <Download size={12} />Exporter le rapport (CSV/PDF)
          </button>
        </div>
      </div>

      {/* ── Filter bar ── */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-card border border-border rounded-lg flex-shrink-0">
        <Filter size={13} className="text-zinc-600 flex-shrink-0" />
        <span className="text-[11px] text-zinc-500 font-medium whitespace-nowrap">Filtres :</span>

        {/* Service */}
        <div className="relative min-w-0 flex-1 max-w-[220px]">
          <select value={svcFilter} onChange={(e) => setSvcFilter(e.target.value)}
            className="w-full appearance-none bg-muted border border-border rounded-lg pl-3 pr-7 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-blue-600/50 cursor-pointer">
            {ALL_SERVICES.map((s) => <option key={s} value={s}>{s === "Tous les services" ? "Filtrer par Service" : s}</option>)}
          </select>
          <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none" />
        </div>

        {/* Sévérité */}
        <div className="relative min-w-0 flex-1 max-w-[180px]">
          <select value={sevFilter} onChange={(e) => setSevFilter(e.target.value as typeof ALL_SEVERITIES[number])}
            className="w-full appearance-none bg-muted border border-border rounded-lg pl-3 pr-7 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-blue-600/50 cursor-pointer">
            {ALL_SEVERITIES.map((s) => <option key={s} value={s}>{s === "Toutes" ? "Sévérité : Toutes" : s}</option>)}
          </select>
          <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none" />
        </div>

        {/* IP */}
        <div className="relative min-w-0 flex-1 max-w-[200px]">
          <select value={ipFilter} onChange={(e) => setIpFilter(e.target.value)}
            className="w-full appearance-none bg-muted border border-border rounded-lg pl-3 pr-7 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-blue-600/50 cursor-pointer">
            {ALL_IPS.map((ip) => <option key={ip} value={ip}>{ip === "Toutes les IPs" ? "Adresse IP : Toutes" : ip}</option>)}
          </select>
          <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none" />
        </div>

        {hasFilter && (
          <button onClick={() => { setSvcFilter("Tous les services"); setSevFilter("Toutes"); setIpFilter("Toutes les IPs"); }}
            className="text-xs font-mono text-zinc-500 hover:text-zinc-400 transition-colors whitespace-nowrap">
            ✕ Réinitialiser
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
          <span>Heure</span>
          <span>Service</span>
          <span>Utilisateur</span>
          <span>Action</span>
          <span>Dangerosité</span>
          <span className="flex items-center gap-1"><Wifi size={9} />IP Source</span>
          <span />
        </div>

        {/* Rows */}
        <div ref={bodyRef} className="overflow-y-auto flex-1 min-h-0" style={{ scrollbarWidth: "none" } as React.CSSProperties}
          onScroll={(e) => setAutoScroll(e.currentTarget.scrollTop < 50)}>

          {shown.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-zinc-500">
              <Terminal size={28} className="mb-2 opacity-20" />
              <p className="text-xs font-mono">Aucun événement correspondant aux filtres</p>
            </div>
          ) : shown.map((log, idx) => {
            const isOpen = expanded === log.id;
            const isNew  = idx === 0 && playing;
            return (
              <div key={log.id} className={isOpen ? "border-l-2 border-blue-500/50" : "border-l-2 border-transparent"}>

                {/* Row */}
                <button
                  onClick={() => setExpanded((p) => p === log.id ? null : log.id)}
                  className={`w-full grid gap-2 px-4 py-[8px] text-left text-xs border-b border-border/30 transition-colors duration-75 group relative
                    ${idx % 2 === 0 ? "bg-card" : "bg-[#0f0f12]"}
                    ${isOpen ? "bg-blue-600/[0.04]" : "hover:bg-blue-500/[0.06] hover:shadow-[inset_2px_0_0_rgba(59,130,246,0.45)]"}`}
                  style={{ gridTemplateColumns: COL }}
                >
                  {isNew && <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-emerald-400/70 animate-pulse" />}

                  <span className="font-mono text-[10px] text-zinc-500 tabular-nums self-center">#{log.id}</span>
                  <span className="font-mono text-[11px] text-zinc-500 tabular-nums self-center">{log.heure}</span>
                  <span className="font-mono text-[11px] text-zinc-400 truncate self-center">{log.service}</span>
                  <span className="text-[11px] text-zinc-300 flex items-center gap-1 truncate self-center">
                    <LogIn size={9} className="text-zinc-500 flex-shrink-0" />{log.utilisateur}
                  </span>
                  <span className={`text-[11px] font-medium truncate self-center ${SEV[log.dangerosite].text}`}>{log.action}</span>
                  <span className="self-center"><Badge level={log.dangerosite} /></span>
                  <span className="font-mono text-[11px] text-zinc-500 self-center">{log.ipSource}</span>
                  <span className="flex items-center justify-center self-center">
                    <ChevronDown size={13} className={`text-zinc-500 group-hover:text-zinc-400 transition-transform duration-200 ${isOpen ? "rotate-180 text-blue-400" : ""}`} />
                  </span>
                </button>

                {/* Accordion */}
                <div className="overflow-hidden transition-all duration-300 ease-in-out"
                  style={{ maxHeight: isOpen ? "500px" : "0px" }}>
                  <div className="bg-[#070709] border-b border-zinc-800/80 px-4 py-4">

                    {/* Accordion header */}
                    <div className="flex items-center gap-3 mb-4">
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${SEV[log.dangerosite].dot}`} />
                      <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
                        Détail de l'événement #{log.id} — {log.service}
                      </span>
                      <div className="flex-1 h-px bg-zinc-800" />
                      <Badge level={log.dangerosite} />
                      <span className="text-[10px] font-mono text-zinc-500">{log.heure}</span>
                    </div>

                    {/* Two-column: summary pills + JSON */}
                    <div className="flex gap-5">

                      {/* Left: field summary */}
                      <div className="w-44 flex-shrink-0 space-y-3">
                        {([
                          ["Service",     log.service],
                          ["Utilisateur", log.utilisateur],
                          ["IP Source",   log.ipSource],
                          ["Sévérité",    log.dangerosite],
                          ["Action",      log.action],
                        ] as [string, string][]).map(([k, v]) => (
                          <div key={k}>
                            <p className="text-[9px] text-zinc-500 uppercase tracking-wider mb-0.5">{k}</p>
                            <p className={`text-[11px] font-mono truncate ${k === "Sévérité" ? SEV[log.dangerosite].text : "text-zinc-300"}`}>{v}</p>
                          </div>
                        ))}
                        {/* MAC address pull-out */}
                        {log.details.reseau && (log.details.reseau as Record<string,unknown>).mac_source && (
                          <div>
                            <p className="text-[9px] text-zinc-500 uppercase tracking-wider mb-0.5">MAC Source</p>
                            <p className="text-[11px] font-mono text-violet-400">{String((log.details.reseau as Record<string,unknown>).mac_source)}</p>
                          </div>
                        )}
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
                          timestamp:   log.heure,
                          service:     log.service,
                          utilisateur: log.utilisateur,
                          action:      log.action,
                          dangerosite: log.dangerosite,
                          ip_source:   log.ipSource,
                          metadata:    log.details.metadata ?? {},
                          erreur:      log.details.erreur   ?? null,
                          reseau:      log.details.reseau   ?? {},
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
            Affichage de <span className="text-zinc-400 font-semibold">{Math.min(shown.length, 50)}</span> derniers événements
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
          <span className="ml-auto text-[10px] font-mono text-zinc-500">
            Màj: <span className="text-zinc-500">{new Date().toLocaleTimeString("fr-FR")}</span>
          </span>
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

const ARCHIVED_REPORTS: Report[] = [
  { id: 1, nom: "audit_sshd_juin2026",       format: "PDF",  debut: "01/06/2026", fin: "12/06/2026", taille: "2.4 Mo",  statut: "Prêt",     genere: "12/06/2026 à 18:42", services: ["sshd.service"], severites: ["CRITIQUE", "AVERTISSEMENT"] },
  { id: 2, nom: "rapport_critique_systeme",  format: "CSV",  debut: "11/06/2026", fin: "11/06/2026", taille: "450 Ko", statut: "Prêt",     genere: "11/06/2026 à 23:07", services: ["auditd", "sudo", "kernel"], severites: ["CRITIQUE"] },
  { id: 3, nom: "analyse_nginx_acces",       format: "JSON", debut: "05/06/2026", fin: "10/06/2026", taille: "1.1 Mo", statut: "Prêt",     genere: "10/06/2026 à 09:15", services: ["nginx"], severites: ["AVERTISSEMENT", "INFO"] },
  { id: 4, nom: "rapport_hebdo_complet",     format: "PDF",  debut: "03/06/2026", fin: "09/06/2026", taille: "5.8 Mo", statut: "Prêt",     genere: "09/06/2026 à 06:00", services: ["Tous"], severites: ["CRITIQUE", "AVERTISSEMENT", "INFO"] },
  { id: 5, nom: "export_postgresql_erreurs", format: "CSV",  debut: "07/06/2026", fin: "07/06/2026", taille: "88 Ko",  statut: "Échec",    genere: "07/06/2026 à 14:33", services: ["postgresql"], severites: ["CRITIQUE"] },
  { id: 6, nom: "synthese_firewalld_mai",    format: "PDF",  debut: "20/05/2026", fin: "31/05/2026", taille: "3.2 Mo", statut: "Prêt",     genere: "31/05/2026 à 22:00", services: ["firewalld"], severites: ["CRITIQUE", "AVERTISSEMENT"] },
  { id: 7, nom: "rapport_temps_reel_live",   format: "JSON", debut: "13/06/2026", fin: "13/06/2026", taille: "—",      statut: "En cours", genere: "13/06/2026 à 20:01", services: ["Tous"], severites: ["CRITIQUE", "AVERTISSEMENT", "INFO"] },
];

const FORMAT_ICON_COLOR: Record<ReportFormat, { icon: string; bg: string; text: string }> = {
  PDF:  { icon: "PDF",  bg: "bg-red-500/10  border-red-500/20",  text: "text-red-400"   },
  CSV:  { icon: "CSV",  bg: "bg-emerald-500/10 border-emerald-500/20", text: "text-emerald-400" },
  JSON: { icon: "JSON", bg: "bg-blue-500/10  border-blue-500/20",  text: "text-blue-400"  },
};

const STATUS_STYLE: Record<ReportStatus, { pill: string; dot: string; label: string }> = {
  "Prêt":     { pill: "bg-emerald-500/10 text-emerald-400 border-emerald-500/25", dot: "bg-emerald-400", label: "Prêt" },
  "En cours": { pill: "bg-blue-500/10    text-blue-400    border-blue-500/25",    dot: "bg-blue-400",    label: "En cours" },
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
        <ChevronUp size={8} className={sortField === field && sortAsc ? "opacity-100 text-blue-400" : ""} />
        <ChevronDown size={8} className={sortField === field && !sortAsc ? "opacity-100 text-blue-400" : ""} style={{ marginTop: -2 }} />
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
  const [reports,     setReports]     = useState<Report[]>(ARCHIVED_REPORTS);
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
                  ? "bg-blue-600/20 border-blue-600/40 text-blue-300"
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
                  className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-xs font-mono text-foreground placeholder:text-zinc-500 focus:outline-none focus:border-blue-600/50 focus:ring-1 focus:ring-blue-600/30 transition-all"
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
                      className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-xs font-mono text-zinc-300 focus:outline-none focus:border-blue-600/50 focus:ring-1 focus:ring-blue-600/30 transition-all [color-scheme:dark]" />
                  </div>
                  <div>
                    <p className="text-[10px] text-zinc-500 mb-1 font-mono">Au</p>
                    <input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)}
                      className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-xs font-mono text-zinc-300 focus:outline-none focus:border-blue-600/50 focus:ring-1 focus:ring-blue-600/30 transition-all [color-scheme:dark]" />
                  </div>
                </div>
              </div>

              {/* Service */}
              <div>
                <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest block mb-2">Service ciblé</label>
                <div className="relative">
                  <select value={selService} onChange={(e) => setSelService(e.target.value)}
                    className="w-full appearance-none bg-muted border border-border rounded-lg pl-3 pr-7 py-2 text-xs text-zinc-300 focus:outline-none focus:border-blue-600/50 cursor-pointer">
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
                    <span className="text-[10px] text-zinc-400 font-mono text-right truncate max-w-[60%]">{v}</span>
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
                    ? "bg-blue-600/20 border border-blue-600/30 text-blue-400 cursor-wait"
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
              <span className={`flex items-center gap-1.5 text-[10px] font-mono ${pendingCnt > 0 ? "text-blue-600" : "text-zinc-500"}`}>
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
  const [saved, setSaved] = useState(false);

  const handlePasswordSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2800);
  };

  return (
    <main
      className="flex-1 overflow-y-auto px-4 py-5 md:px-6"
      style={{ scrollbarWidth: "none" } as React.CSSProperties}
    >
      <div className="mb-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-blue-600/30 bg-blue-600/20">
            <UserCog size={15} className="text-blue-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-zinc-100">Mon Profil</h2>
            <p className="mt-0.5 text-xs font-mono text-zinc-500">
              Identité administrateur et sécurité du compte
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,0.92fr)_minmax(360px,0.68fr)]">
        <section className="rounded-xl border border-zinc-800/80 bg-card/95 shadow-[0_18px_50px_rgba(0,0,0,0.22)]">
          <div className="flex items-center gap-2.5 border-b border-border bg-[#0d0d10] px-5 py-3.5">
            <ShieldCheck size={15} className="text-blue-400" />
            <h3 className="text-sm font-semibold">Informations Générales</h3>
          </div>

          <div className="space-y-5 px-5 py-5">
            <div className="grid gap-4 md:grid-cols-3">
              <ProfileReadOnlyField label="Username" value="aldoesp" icon={UserCog} />
              <ProfileReadOnlyField label="ID" value="aldoesp" icon={KeyRound} />
              <ProfileReadOnlyField label="Rôle actuel" value="Administrateur" icon={ShieldCheck} />
            </div>

            <div className="rounded-lg border border-blue-600/20 bg-blue-600/5 px-4 py-3">
              <div className="flex items-center gap-2.5">
                <CalendarDays size={14} className="text-blue-400" />
                <p className="text-xs font-medium text-zinc-300">
                  Membre depuis le 22 Juin 2026
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-zinc-800/80 bg-card/95 shadow-[0_18px_50px_rgba(0,0,0,0.22)]">
          <div className="flex items-center gap-2.5 border-b border-border bg-[#0d0d10] px-5 py-3.5">
            <KeyRound size={15} className="text-amber-400" />
            <h3 className="text-sm font-semibold">Changer le mot de passe</h3>
          </div>

          <form onSubmit={handlePasswordSubmit} className="space-y-4 px-5 py-5">
            {[
              ["Mot de passe actuel", "current-password"],
              ["Nouveau mot de passe", "new-password"],
              ["Confirmer le nouveau mot de passe", "new-password"],
            ].map(([label, autoComplete]) => (
              <label key={label} className="block">
                <span className="mb-2 block text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
                  {label}
                </span>
                <div className="relative">
                  <KeyRound size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
                  <input
                    type="password"
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

            {saved && (
              <p className="text-center text-[11px] font-mono text-emerald-400">
                Modifications prêtes à être synchronisées.
              </p>
            )}
          </form>
        </section>
      </div>
    </main>
  );
}

// ── Sessions utilisateur view ─────────────────────────────────────────────────

type SessionStatus = "Succès" | "Échec";

const USER_SESSION_LOGS: {
  id: number;
  datetime: string;
  ip: string;
  status: SessionStatus;
  userAgent: string;
}[] = [
  {
    id: 1,
    datetime: "22/06/2026 11:28:42",
    ip: "192.168.1.24",
    status: "Succès",
    userAgent: "Firefox 127 · Kali Linux",
  },
  {
    id: 2,
    datetime: "22/06/2026 08:14:09",
    ip: "192.168.1.24",
    status: "Succès",
    userAgent: "Firefox 127 · Kali Linux",
  },
  {
    id: 3,
    datetime: "21/06/2026 23:51:33",
    ip: "203.0.113.42",
    status: "Échec",
    userAgent: "Chrome 124 · Windows 10",
  },
  {
    id: 4,
    datetime: "21/06/2026 19:06:18",
    ip: "10.8.0.14",
    status: "Succès",
    userAgent: "Firefox 126 · Ubuntu 24.04",
  },
  {
    id: 5,
    datetime: "20/06/2026 07:42:55",
    ip: "198.51.100.14",
    status: "Échec",
    userAgent: "curl/8.5.0 · Inconnu",
  },
  {
    id: 6,
    datetime: "19/06/2026 16:20:11",
    ip: "172.23.0.1",
    status: "Succès",
    userAgent: "Chromium 126 · Linux",
  },
];

const SESSION_STATUS_STYLE: Record<SessionStatus, { label: string; badge: string; dot: string }> = {
  Succès: {
    label: "Connexion réussie",
    badge: "border-emerald-500/25 bg-emerald-500/10 text-emerald-400",
    dot: "bg-emerald-400",
  },
  Échec: {
    label: "Échec d'authentification",
    badge: "border-red-500/25 bg-red-500/10 text-red-400",
    dot: "bg-red-500",
  },
};

function SessionsView() {
  return (
    <main
      className="flex-1 overflow-y-auto px-4 py-5 md:px-6"
      style={{ scrollbarWidth: "none" } as React.CSSProperties}
    >
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-blue-600/30 bg-blue-600/20">
            <History size={15} className="text-blue-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-zinc-100">Journal de mes connexions</h2>
            <p className="mt-0.5 text-xs font-mono text-zinc-500">
              Audit des sessions utilisateur pour aldoesp
            </p>
          </div>
        </div>

        <button
          type="button"
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-blue-600/25 bg-blue-600/10 px-3 py-2 text-xs font-semibold text-blue-400 transition hover:bg-blue-600/20"
        >
          <Download size={14} />
          Exporter les logs de session
        </button>
      </div>

      <section className="overflow-hidden rounded-xl border border-zinc-800/80 bg-card/95 shadow-[0_18px_50px_rgba(0,0,0,0.22)]">
        <div className="flex items-center justify-between border-b border-border bg-[#0d0d10] px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <ShieldCheck size={15} className="text-blue-400" />
            <h3 className="text-sm font-semibold">Historique des dernières connexions</h3>
          </div>
          <span className="rounded-full bg-zinc-800/70 px-2.5 py-1 text-[10px] font-mono font-semibold text-zinc-500">
            {USER_SESSION_LOGS.length} entrées
          </span>
        </div>

        <div className="hidden grid-cols-[170px_150px_210px_1fr] gap-4 border-b border-border bg-muted/30 px-5 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-zinc-600 md:grid">
          <span>Date & Heure</span>
          <span>Adresse IP Source</span>
          <span>Statut</span>
          <span>Navigateur/OS détecté</span>
        </div>

        <div className="divide-y divide-border/40">
          {USER_SESSION_LOGS.map((session) => {
            const style = SESSION_STATUS_STYLE[session.status];
            return (
              <div
                key={session.id}
                className="grid gap-3 px-5 py-4 text-xs transition hover:bg-blue-500/[0.06] hover:shadow-[inset_2px_0_0_rgba(59,130,246,0.45)] md:grid-cols-[170px_150px_210px_1fr] md:items-center md:gap-4"
              >
                <div>
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-500 md:hidden">
                    Date & Heure
                  </p>
                  <p className="font-mono text-zinc-300">{session.datetime}</p>
                </div>

                <div>
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-500 md:hidden">
                    Adresse IP Source
                  </p>
                  <p className="font-mono text-zinc-400">{session.ip}</p>
                </div>

                <div>
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-500 md:hidden">
                    Statut
                  </p>
                  <span className={`inline-flex items-center gap-1.5 rounded border px-2.5 py-1 text-[10px] font-mono font-semibold ${style.badge}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
                    {style.label}
                  </span>
                </div>

                <div className="min-w-0">
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-500 md:hidden">
                    Navigateur/OS détecté
                  </p>
                  <p className="truncate font-mono text-zinc-500">{session.userAgent}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>
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
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-blue-600/30 bg-blue-600/20">
            <ShieldCheck size={15} className="text-blue-400" />
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
                <KeyRound size={15} className="text-blue-400" />
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
                  className="grid gap-3 px-5 py-4 transition hover:bg-blue-500/[0.06] hover:shadow-[inset_2px_0_0_rgba(59,130,246,0.45)] md:grid-cols-[minmax(0,1fr)_170px_110px] md:items-center"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-blue-600/20 bg-blue-600/10">
                        <KeyRound size={14} className="text-blue-400" />
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
            onClick={() => setPasswordAccessDisabled((enabled) => !enabled)}
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
      detail: "Expiration simulée après 30 minutes d'inactivité",
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
          <ShieldCheck size={15} className="text-blue-400" />
          <h3 className="text-sm font-semibold">Règles de sécurité administrateur</h3>
        </div>
        <div className="divide-y divide-border/40">
          {rules.map(({ label, detail, enabled, setEnabled }) => (
            <button
              key={label}
              type="button"
              onClick={() => setEnabled((value) => !value)}
              className="flex w-full items-center justify-between gap-5 px-5 py-4 text-left transition hover:bg-blue-500/[0.06] hover:shadow-[inset_2px_0_0_rgba(59,130,246,0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30"
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
          Simulation d'accès
        </p>
        <div className="mt-4 space-y-3">
          {[
            ["Tentatives refusées", "12", "text-red-400"],
            ["Sessions actives", "2", "text-emerald-400"],
            ["Dernier contrôle", "Aujourd'hui 11:28", "text-blue-400"],
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
            onClick={() => setEnabled((value) => !value)}
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
              onChange={(event) => setSensitivity(event.target.value)}
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
          Détections simulées
        </p>
        <div className="mt-4 space-y-3">
          {[
            ["Brute-force SSH progressif", "Critique", "text-red-400"],
            ["sudo répété hors plage habituelle", "Avertissement", "text-amber-400"],
            ["Connexion admin depuis nouvelle IP", "À vérifier", "text-blue-400"],
          ].map(([label, value, color]) => (
            <div key={label} className="rounded-lg border border-zinc-800 bg-[#0d0d10] px-3 py-2.5">
              <p className="truncate text-xs font-medium text-zinc-300">{label}</p>
              <p className={`mt-1 text-[10px] font-mono font-semibold ${color}`}>{value}</p>
            </div>
          ))}
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
        <Settings size={15} className="text-blue-400" />
        <h3 className="text-sm font-semibold">Préférences générales d'audit</h3>
      </div>

      <div className="grid gap-5 px-5 py-5 md:grid-cols-2">
        <label className="block">
          <span className="mb-2 block text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
            Conservation des logs
          </span>
          <select
            value={retentionDays}
            onChange={(event) => setRetentionDays(event.target.value)}
            className="w-full appearance-none rounded-lg border border-border bg-muted px-3 py-3 text-xs text-zinc-200 outline-none transition focus:border-blue-500/45 focus:ring-1 focus:ring-blue-500/25"
          >
            <option>30 jours</option>
            <option>90 jours</option>
            <option>180 jours</option>
            <option>365 jours</option>
          </select>
        </label>

        <button
          type="button"
          onClick={() => setAutoRefresh((value) => !value)}
          className="flex items-center justify-between gap-4 rounded-lg border border-border bg-[#0d0d10] p-4 text-left transition hover:border-blue-500/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30"
          aria-pressed={autoRefresh}
        >
          <span>
            <span className="block text-sm font-medium text-zinc-100">Actualisation automatique</span>
            <span className="mt-1 block text-[11px] text-zinc-500">Rafraîchit les flux d'audit en arrière-plan</span>
          </span>
          <span
            className={`relative h-6 w-11 flex-shrink-0 rounded-full border transition ${
              autoRefresh ? "border-blue-500/50 bg-blue-500/25" : "border-zinc-700 bg-zinc-900"
            }`}
          >
            <span
              className={`absolute top-1 h-4 w-4 rounded-full transition ${
                autoRefresh ? "left-6 bg-blue-300 shadow-lg shadow-blue-500/25" : "left-1 bg-zinc-600"
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
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-blue-600/30 bg-blue-600/20">
            <Settings size={15} className="text-blue-400" />
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
                    ? "bg-blue-600/20 text-blue-300 shadow-inner shadow-blue-950/40"
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
                <KeyRound size={15} className="text-blue-400" />
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
                      className="w-full rounded-lg border border-border bg-[#0b0d12] px-3 py-3 pr-11 font-mono text-xs text-zinc-200 outline-none ring-1 ring-inset ring-white/[0.03] transition selection:bg-amber-500/20 focus:border-blue-600/50 focus:ring-1 focus:ring-blue-600/30"
                    />
                    <Shield size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600" />
                  </div>
                  <button
                    type="button"
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-700 px-3 py-3 text-xs font-semibold text-zinc-300 transition hover:border-blue-500/50 hover:bg-blue-500/10 hover:text-blue-300"
                    title="Copier le token"
                  >
                    <Copy size={14} />
                    Copier
                  </button>
                  <button
                    type="button"
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
              <span className="rounded-full bg-blue-600/10 px-2.5 py-1 text-[10px] font-mono font-semibold text-blue-400">
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
                      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-blue-600/20 bg-blue-600/10">
                        <Icon size={17} className="text-blue-400" />
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
                ["File d'ingestion", "Stable", "text-blue-400"],
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
  const [playing,   setPlaying]   = useState(true);
  const [logs,      setLogs]      = useState<LogEntry[]>(SEED);

  useEffect(() => { document.documentElement.classList.add("dark"); }, []);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setLogs((p) => [mkLiveLog(), ...p].slice(0, 200)), 3000);
    return () => clearInterval(id);
  }, [playing]);

  const handleClear = useCallback(() => {
    setLogs([]);
    _idCtr = 1;
  }, []);

  const nav = (id: NavId) => setActiveNav(id);

  return (
    <Shell active={activeNav} onNav={nav} onLogout={onLogout}>
      {activeNav === "live" ? (
        <HistoriqueLiveView logs={logs} playing={playing} setPlaying={setPlaying} onClear={handleClear} />
      ) : activeNav === "dashboard" ? (
        <DashboardView logs={logs} playing={playing} setPlaying={setPlaying} />
      ) : activeNav === "rapports" ? (
        <RapportsView />
      ) : activeNav === "parametres" ? (
        <ParametresView />
      ) : activeNav === "profil" ? (
        <ProfilView />
      ) : activeNav === "sessions" ? (
        <SessionsView />
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
