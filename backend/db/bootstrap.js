import bcrypt from 'bcryptjs';
import pool from './pool.js';

const LEGACY_ADMIN_HASH = '$2b$10$pMyZgWC/ymsSkw2neNoLBOaWXEWVWpE74vs6lUeiXobhoHcL7UZdi';

const requireInitialPassword = (password) => {

  if (!password || password.length < 8) {
    throw new Error(
      'ADMIN_INITIAL_PASS must be set to at least 8 characters when creating or migrating the admin account'
    );
  }

  return password;
};

export const bootstrapAdmin = async ({
  dbPool = pool,
  initialPassword = process.env.ADMIN_INITIAL_PASS,
  hashPassword = (password) => bcrypt.hash(password, 10)
} = {}) => {
  let conn;

  try {
    conn = await dbPool.getConnection();

    const legacyAdmins = await conn.query(
      'SELECT id FROM users WHERE username = ? AND role = ? AND password_hash = ?',
      ['admin', 'admin', LEGACY_ADMIN_HASH]
    );

    if (legacyAdmins.length > 0) {
      const passwordHash = await hashPassword(requireInitialPassword(initialPassword));
      await conn.query(
        'UPDATE users SET password_hash = ?, force_password_change = TRUE WHERE id = ?',
        [passwordHash, legacyAdmins[0].id]
      );
      console.log('Migrated legacy admin credentials; password change required on next login');
      return;
    }

    const admins = await conn.query(
      'SELECT id FROM users WHERE role = ? LIMIT 1',
      ['admin']
    );

    if (admins.length > 0) {
      return;
    }

    const passwordHash = await hashPassword(requireInitialPassword(initialPassword));
    await conn.query(
      'INSERT INTO users (username, password_hash, role, force_password_change) VALUES (?, ?, ?, TRUE)',
      ['admin', passwordHash, 'admin']
    );
    console.log('Created initial admin account; password change required on first login');
  } finally {
    if (conn) conn.end();
  }
};
