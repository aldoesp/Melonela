const pool = require('../config/db');
const { recordUserAction } = require('./userActionService');
const { mapProfile } = require('./profileService');

const ROLES = ['user', 'auditor', 'admin', 'super_admin'];

function toPositiveInt(value, fallback, max) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

function ensureRole(role) {
  if (!ROLES.includes(role)) {
    const error = new Error('Invalid role');
    error.status = 400;
    throw error;
  }
}

function canAssignRole(actorRole, targetRole) {
  if (actorRole === 'super_admin') return true;
  if (actorRole === 'admin') return ['user', 'auditor'].includes(targetRole);
  return false;
}

function buildUserWhere(query) {
  const conditions = [];
  const values = [];

  if (query.search) {
    values.push(`%${query.search.trim()}%`);
    const index = values.length;
    conditions.push(`(
      username ILIKE $${index}
      OR COALESCE(first_name, '') ILIKE $${index}
      OR COALESCE(last_name, '') ILIKE $${index}
      OR COALESCE(email, '') ILIKE $${index}
    )`);
  }

  if (query.role) {
    values.push(query.role);
    conditions.push(`role = $${values.length}`);
  }

  return {
    clause: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '',
    values,
  };
}

async function listUsers(query = {}) {
  const page = toPositiveInt(query.page, 1, 100000);
  const limit = toPositiveInt(query.limit, 20, 100);
  const offset = (page - 1) * limit;
  const { clause, values } = buildUserWhere(query);

  const countResult = await pool.query(`SELECT COUNT(*)::int AS total FROM users ${clause}`, values);
  const total = countResult.rows[0]?.total || 0;

  const result = await pool.query(
    `SELECT id, username, first_name, last_name, email, role, is_active, created_at, updated_at, last_login_at
     FROM users
     ${clause}
     ORDER BY created_at DESC, id DESC
     LIMIT $${values.length + 1}
     OFFSET $${values.length + 2}`,
    [...values, limit, offset]
  );

  return {
    data: result.rows.map(mapProfile),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1),
    },
  };
}

async function getUser(id) {
  const result = await pool.query(
    `SELECT id, username, first_name, last_name, email, role, is_active, created_at, updated_at, last_login_at
     FROM users
     WHERE id = $1`,
    [id]
  );

  if (result.rows.length === 0) {
    const error = new Error('User not found');
    error.status = 404;
    throw error;
  }

  return mapProfile(result.rows[0]);
}

async function updateUser(actor, id, data, req) {
  const existing = await getUser(id);
  const nextRole = data.role || existing.role;
  ensureRole(nextRole);

  if (nextRole !== existing.role && !canAssignRole(actor.role, nextRole)) {
    const error = new Error('Cannot assign this role');
    error.status = 403;
    throw error;
  }

  const result = await pool.query(
    `UPDATE users
     SET first_name = $1,
         last_name = $2,
         email = $3,
         role = $4,
         is_active = $5,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $6
     RETURNING id, username, first_name, last_name, email, role, is_active, created_at, updated_at, last_login_at`,
    [
      data.firstName ?? existing.firstName,
      data.lastName ?? existing.lastName,
      data.email ?? existing.email,
      nextRole,
      typeof data.isActive === 'boolean' ? data.isActive : existing.isActive,
      id,
    ]
  );

  await recordUserAction({
    user: actor,
    actionType: 'USER_UPDATED',
    resource: `Utilisateur #${id}`,
    req,
    details: { targetUserId: id, role: nextRole },
  });

  return mapProfile(result.rows[0]);
}

async function deleteUser(actor, id, req) {
  if (Number(actor.id) === Number(id)) {
    const error = new Error('Cannot delete own account');
    error.status = 400;
    throw error;
  }

  const user = await getUser(id);
  await pool.query('UPDATE users SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [id]);

  await recordUserAction({
    user: actor,
    actionType: 'USER_DELETED',
    resource: `Utilisateur #${id}`,
    req,
    details: { targetUserId: id, username: user.username },
  });
}

module.exports = {
  ROLES,
  listUsers,
  getUser,
  updateUser,
  deleteUser,
};
