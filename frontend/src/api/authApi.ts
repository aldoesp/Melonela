const API_BASE_URL = 'http://localhost:5000';

export interface AuthUser {
  id: number;
  username: string;
  role: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
}

export interface UserActionLog {
  id: number;
  username: string;
  action_type: string;
  resource: string | null;
  status: string;
  ip_source: string | null;
  user_agent: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

export interface UserProfile {
  id: number;
  username: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  role: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
}

export interface UserListResponse {
  data: UserProfile[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

function getAuthHeaders() {
  const token = localStorage.getItem('token');

  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

async function parseJsonResponse(response: Response) {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401) {
      handleUnauthorized();
    }
    const message = data?.error || `Erreur ${response.status}`;
    throw new Error(message);
  }

  return data;
}

function handleUnauthorized() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  localStorage.setItem('authMessage', 'Session expirée. Veuillez vous reconnecter.');
  window.dispatchEvent(new CustomEvent('auth:unauthorized'));
}

// ─── Fonction de login (existante) ───
export async function loginUser(username: string, password: string) {
  const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username, password }),
  });
  const data = await response.json();

  if (!response.ok) {
    const message = data?.error || `Erreur ${response.status}`;
    throw new Error(message);
  }

  localStorage.setItem('token', data.token);
  if (data.user) {
    localStorage.setItem('user', JSON.stringify(data.user));
  }
  return data;
}

// ─── NOUVELLE Fonction d'inscription ───
export async function registerUser(username: string, password: string) {
  const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
    method: 'POST', // Toujours POST pour l'inscription
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username, password }), // Envoie uniquement username et password
  });

  const data = await response.json();

  if (!response.ok) {
    // Gérer les erreurs potentielles du backend (ex: username déjà pris)
    const message = data?.error || `Erreur ${response.status}`;
    throw new Error(message);
  }

  // Note: L'inscription ne renvoie normalement pas de token.
  // L'utilisateur devra se connecter après l'inscription.
  // Donc, on ne fait PAS : localStorage.setItem('token', data.token);

  return data; // Retourne les infos de l'utilisateur créé si nécessaire
}


export function getCurrentUser(): AuthUser | null {
  const raw = localStorage.getItem('user');

  if (!raw) return null;

  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    localStorage.removeItem('user');
    return null;
  }
}

export async function getMyUserActions(limit = 100): Promise<UserActionLog[]> {
  const response = await fetch(`${API_BASE_URL}/api/user-actions?limit=${limit}`, {
    headers: getAuthHeaders(),
  });

  const data = await response.json();

  if (!response.ok) {
    if (response.status === 401) {
      handleUnauthorized();
    }
    const message = data?.error || `Erreur ${response.status}`;
    throw new Error(message);
  }

  return data.actions;
}

export async function getProfile(): Promise<UserProfile> {
  const response = await fetch(`${API_BASE_URL}/api/profile`, {
    headers: getAuthHeaders(),
  });
  const data = await parseJsonResponse(response);
  return data.profile;
}

export async function updateProfile(payload: Pick<UserProfile, 'firstName' | 'lastName' | 'email'>): Promise<UserProfile> {
  const response = await fetch(`${API_BASE_URL}/api/profile`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await parseJsonResponse(response);
  localStorage.setItem('user', JSON.stringify({
    id: data.profile.id,
    username: data.profile.username,
    role: data.profile.role,
    firstName: data.profile.firstName,
    lastName: data.profile.lastName,
    email: data.profile.email,
  }));
  return data.profile;
}

export async function updatePassword(currentPassword: string, newPassword: string) {
  const response = await fetch(`${API_BASE_URL}/api/profile/password`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  return parseJsonResponse(response);
}

export async function getUsers(params: Record<string, string | number | undefined> = {}): Promise<UserListResponse> {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') query.set(key, String(value));
  });

  const response = await fetch(`${API_BASE_URL}/api/users?${query.toString()}`, {
    headers: getAuthHeaders(),
  });

  return parseJsonResponse(response);
}

export async function updateUser(id: number, payload: Partial<UserProfile>) {
  const response = await fetch(`${API_BASE_URL}/api/users/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await parseJsonResponse(response);
  return data.user as UserProfile;
}

export async function deleteUser(id: number) {
  const response = await fetch(`${API_BASE_URL}/api/users/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });

  if (response.status === 204) return;
  await parseJsonResponse(response);
}

export function getExportUrl(format: 'json' | 'csv' | 'pdf', params: Record<string, string | number | undefined> = {}) {
  const query = new URLSearchParams();
  const token = localStorage.getItem('token');
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') query.set(key, String(value));
  });
  if (token) query.set('token', token);
  return `${API_BASE_URL}/api/export/${format}?${query.toString()}`;
}

export async function trackUserAction(
  actionType: string,
  resource?: string,
  details: Record<string, unknown> = {},
) {
  const token = localStorage.getItem('token');
  if (!token) return null;

  const response = await fetch(`${API_BASE_URL}/api/user-actions`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ actionType, resource, details }),
  });

  if (!response.ok) {
    if (response.status === 401) {
      handleUnauthorized();
    }
    return null;
  }

  const data = await response.json();
  return data.action;
}
