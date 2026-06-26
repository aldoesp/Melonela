const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { recordUserAction } = require('./userActionService');

// --- LOGIN ---
const authenticateUser = async (username, password, req) => {
  const result = await pool.query(
    'SELECT * FROM users WHERE username = $1 AND is_active = TRUE',
    [username]
  );

  if (result.rows.length === 0) {
    throw new Error('Invalid credentials');
  }

  const user = result.rows[0];

  const isMatch = await bcrypt.compare(password, user.password_hash);
  if (!isMatch) {
    throw new Error('Invalid credentials');
  }

  await pool.query(
    `INSERT INTO audit_logs (service_name, ip_source, action_type, severity, message)
     VALUES ($1, $2, $3, $4, $5)`,
    ['auth-service', 'IP_INCONNUE_POUR_LE_SERVICE', 'LOGIN_SUCCESS', 'INFO', `Login réussi: ${username}`]
  );

  await recordUserAction({
    user,
    actionType: 'LOGIN_SUCCESS',
    resource: 'Authentification',
    req,
    details: { role: user.role },
  });

  await pool.query('UPDATE users SET last_login_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role }, // role est récupéré de la DB
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  );

  return {
    token,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      firstName: user.first_name,
      lastName: user.last_name,
      email: user.email,
    }
  };
};

// --- REGISTER ---
const createUser = async (username, password, req, profile = {}) => { // role retiré des arguments
  // 1. Hasher le mot de passe
  const saltRounds = 10;
  const hashedPassword = await bcrypt.hash(password, saltRounds);

  // 2. Insérer l'utilisateur dans la base de données avec le rôle par défaut
  const result = await pool.query(
    `INSERT INTO users (username, password_hash, role, first_name, last_name, email)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, username, role, first_name, last_name, email`,
    [username, hashedPassword, 'user', profile.firstName || null, profile.lastName || null, profile.email || null]
  );

  const newUser = result.rows[0];

  // 3. Logger l'action d'inscription
  await pool.query(
    `INSERT INTO audit_logs (service_name, ip_source, action_type, severity, message)
     VALUES ($1, $2, $3, $4, $5)`,
    ['auth-service', 'IP_INCONNUE_POUR_LE_SERVICE', 'USER_REGISTERED', 'INFO', `Nouvel utilisateur créé: ${username}`]
  );

  await recordUserAction({
    user: newUser,
    actionType: 'USER_REGISTERED',
    resource: 'Création du compte',
    req,
    details: { createdBy: 'self-registration' },
  });

  return newUser;
};

module.exports = { authenticateUser, createUser };
