const pool = require('../config/db');

async function ensureUserActionTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_action_logs (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      username VARCHAR(50) NOT NULL,
      action_type VARCHAR(100) NOT NULL,
      resource VARCHAR(120),
      status VARCHAR(20) NOT NULL DEFAULT 'SUCCESS',
      ip_source VARCHAR(45),
      user_agent TEXT,
      details JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query('CREATE INDEX IF NOT EXISTS idx_user_action_logs_user_id ON user_action_logs(user_id)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_user_action_logs_created_at ON user_action_logs(created_at DESC)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_user_action_logs_action_type ON user_action_logs(action_type)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_user_action_logs_resource ON user_action_logs(resource)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_user_action_logs_status ON user_action_logs(status)');
}

function getClientIp(req) {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.length > 0) {
    return forwardedFor.split(',')[0].trim();
  }

  return req.ip || req.socket?.remoteAddress || 'IP_INCONNUE';
}

function getUserAgent(req) {
  return req.headers['user-agent'] || 'USER_AGENT_INCONNU';
}

async function recordUserAction({ user, actionType, resource, status = 'SUCCESS', req, details = {} }) {
  if (!user?.id || !user?.username) return null;

  const result = await pool.query(
    `INSERT INTO user_action_logs
      (user_id, username, action_type, resource, status, ip_source, user_agent, details)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, user_id, username, action_type, resource, status, ip_source, user_agent, details, created_at`,
    [
      user.id,
      user.username,
      actionType,
      resource || null,
      status,
      req ? getClientIp(req) : null,
      req ? getUserAgent(req) : null,
      details,
    ]
  );

  return result.rows[0];
}

async function getUserActions(userId, { limit = 100 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 250);

  const result = await pool.query(
    `SELECT id, username, action_type, resource, status, ip_source, user_agent, details, created_at
     FROM user_action_logs
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, safeLimit]
  );

  return result.rows;
}

module.exports = {
  ensureUserActionTable,
  recordUserAction,
  getUserActions,
};
