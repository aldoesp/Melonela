const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const { recordUserAction } = require('./userActionService');

function mapProfile(row) {
  return {
    id: row.id,
    username: row.username,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    role: row.role,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastLoginAt: row.last_login_at,
  };
}

async function getProfile(userId) {
  const result = await pool.query(
    `SELECT id, username, first_name, last_name, email, role, is_active, created_at, updated_at, last_login_at
     FROM users
     WHERE id = $1`,
    [userId]
  );

  if (result.rows.length === 0) {
    const error = new Error('Profile not found');
    error.status = 404;
    throw error;
  }

  return mapProfile(result.rows[0]);
}

async function updateProfile(user, data, req) {
  const result = await pool.query(
    `UPDATE users
     SET first_name = $1, last_name = $2, email = $3, updated_at = CURRENT_TIMESTAMP
     WHERE id = $4
     RETURNING id, username, first_name, last_name, email, role, is_active, created_at, updated_at, last_login_at`,
    [
      data.firstName || null,
      data.lastName || null,
      data.email || null,
      user.id,
    ]
  );

  await recordUserAction({
    user,
    actionType: 'PROFILE_UPDATED',
    resource: 'Profil utilisateur',
    req,
    details: { fields: ['firstName', 'lastName', 'email'] },
  });

  return mapProfile(result.rows[0]);
}

async function updatePassword(user, { currentPassword, newPassword }, req) {
  const result = await pool.query(
    'SELECT id, username, password_hash, role FROM users WHERE id = $1 AND is_active = TRUE',
    [user.id]
  );

  if (result.rows.length === 0) {
    const error = new Error('Profile not found');
    error.status = 404;
    throw error;
  }

  const existing = result.rows[0];
  const matches = await bcrypt.compare(currentPassword, existing.password_hash);
  if (!matches) {
    const error = new Error('Current password is invalid');
    error.status = 400;
    throw error;
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);
  await pool.query(
    'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
    [hashedPassword, user.id]
  );

  await recordUserAction({
    user,
    actionType: 'PASSWORD_CHANGED',
    resource: 'Mot de passe',
    req,
    details: { changedBy: user.username },
  });
}

module.exports = {
  getProfile,
  updateProfile,
  updatePassword,
  mapProfile,
};
