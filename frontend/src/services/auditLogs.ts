import { io, type Socket } from "socket.io-client";

const API_BASE_URL = "http://localhost:5000";

export interface AuditLog {
  id: number;
  sourceName: string;
  sourceType: string;
  service: string | null;
  processName: string | null;
  processId: string | null;
  hostName: string | null;
  eventType: string;
  severity: "low" | "medium" | "high" | "critical";
  username: string | null;
  tty: string | null;
  workingDirectory: string | null;
  targetUser: string | null;
  command: string | null;
  message: string;
  title: string | null;
  description: string | null;
  category: string | null;
  icon: string | null;
  humanSeverity: "low" | "medium" | "high" | "critical" | null;
  interpretationRuleId: string | null;
  interpretationConfidence: number | null;
  rawPayload: Record<string, unknown>;
  normalizedPayload: Record<string, unknown>;
  eventTimestamp: string;
  receivedAt: string;
  createdAt: string;
}

export interface AuditLogQuery {
  page?: number;
  limit?: number;
  search?: string;
  severity?: string;
  event_type?: string;
  source_type?: string;
  service?: string;
  username?: string;
  command?: string;
  working_directory?: string;
  category?: string;
  human_severity?: string;
  interpretation_rule_id?: string;
  date_from?: string;
  date_to?: string;
}

export interface AuditLogPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface AuditLogResponse {
  data: AuditLog[];
  pagination: AuditLogPagination;
}

export interface AuditLogHourlyStatsPoint {
  bucketStart: string;
  info: number;
  warning: number;
  critical: number;
  total: number;
}

export interface AuditLogHourlyStatsResponse {
  hours: number;
  generatedAt: string;
  data: AuditLogHourlyStatsPoint[];
}

export interface JournalctlLiveStatus {
  running: boolean;
  startedAt: string | null;
  processedCount: number;
  rejectedCount: number;
  lastError: string | null;
}

export class UnauthorizedError extends Error {
  constructor(message = "Session expirée. Veuillez vous reconnecter.") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

function getToken() {
  return localStorage.getItem("token");
}

function notifyUnauthorized() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  localStorage.setItem("authMessage", "Session expirée. Veuillez vous reconnecter.");
  window.dispatchEvent(new CustomEvent("auth:unauthorized"));
}

function buildQueryString(query: AuditLogQuery = {}) {
  const params = new URLSearchParams();

  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      params.set(key, String(value));
    }
  });

  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

async function requestAuditLogs(query: AuditLogQuery = {}): Promise<AuditLogResponse> {
  const response = await fetch(`${API_BASE_URL}/api/audit-logs${buildQueryString(query)}`, {
    headers: {
      Authorization: `Bearer ${getToken()}`,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (response.status === 401) {
    notifyUnauthorized();
    throw new UnauthorizedError(data?.error);
  }

  if (!response.ok) {
    throw new Error(data?.error || `Erreur ${response.status}`);
  }

  return data;
}

export function getAuditLogs(query: AuditLogQuery = {}) {
  return requestAuditLogs(query);
}

export function searchAuditLogs(search: string, query: AuditLogQuery = {}) {
  return requestAuditLogs({ ...query, search, page: query.page ?? 1 });
}

export function filterAuditLogs(query: AuditLogQuery = {}) {
  return requestAuditLogs({ ...query, page: query.page ?? 1 });
}

export async function getAuditLogHourlyStats(hours = 24): Promise<AuditLogHourlyStatsResponse> {
  const response = await fetch(`${API_BASE_URL}/api/audit-logs/stats/hourly?hours=${hours}`, {
    headers: {
      Authorization: `Bearer ${getToken()}`,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (response.status === 401) {
    notifyUnauthorized();
    throw new UnauthorizedError(data?.error);
  }

  if (!response.ok) {
    throw new Error(data?.error || `Erreur ${response.status}`);
  }

  return data;
}

async function requestJournalctlLive(path: string, method = "GET"): Promise<JournalctlLiveStatus> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${getToken()}`,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (response.status === 401) {
    notifyUnauthorized();
    throw new UnauthorizedError(data?.error);
  }

  if (!response.ok) {
    throw new Error(data?.error || `Erreur ${response.status}`);
  }

  return data.status ?? data;
}

export function getJournalctlLiveStatus() {
  return requestJournalctlLive("/api/ingest/journalctl/status");
}

export function startJournalctlLive() {
  return requestJournalctlLive("/api/ingest/journalctl/start", "POST");
}

export function stopJournalctlLive() {
  return requestJournalctlLive("/api/ingest/journalctl/stop", "POST");
}

export async function collectJournalctlLogs(): Promise<JournalctlLiveStatus> {
  return startJournalctlLive();
}

export function connectAuditLogSocket(onCreated: (log: AuditLog) => void): Socket {
  const socket = io(API_BASE_URL, {
    auth: {
      token: getToken(),
    },
  });

  socket.on("system_event_created", onCreated);

  return socket;
}
