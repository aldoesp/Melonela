const pool = require('../config/db');

async function ensureUserSchema() {
  await pool.query(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS first_name VARCHAR(80),
      ADD COLUMN IF NOT EXISTS last_name VARCHAR(80),
      ADD COLUMN IF NOT EXISTS email VARCHAR(160) UNIQUE,
      ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE
  `);

  await pool.query("ALTER TABLE users ALTER COLUMN role TYPE VARCHAR(50)");
  await pool.query("ALTER TABLE users ALTER COLUMN role SET DEFAULT 'user'");
  await pool.query("UPDATE users SET role = 'user' WHERE role IS NULL");
  await pool.query('CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');
}

module.exports = {
  ensureUserSchema,
};
