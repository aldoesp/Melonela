const API_BASE_URL = 'http://localhost:5000';

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

  console.log("Inscription réussie :", data.message); // Facultatif
  return data; // Retourne les infos de l'utilisateur créé si nécessaire
}


// ─── Requête protégée (avec le JWT) ───
export async function getAuditLogs() {
  const token = localStorage.getItem('token');

  const response = await fetch(`${API_BASE_URL}/api/audit-logs`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Impossible de récupérer les logs');
  }

  const logs = await response.json();
  return logs;
}