import express from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import pool from '../db/pool.js';
import adminMiddleware from '../middleware/admin.js';

const router = express.Router();

export const restoreDatabase = async ({
  conn,
  users,
  entries,
  placeholderHash
}) => {
  await conn.beginTransaction();

  try {
    // Delete child rows first so foreign keys remain enforced throughout.
    await conn.query('DELETE FROM entries');
    await conn.query('DELETE FROM users');

    if (users.length > 0) {
      const userValues = users.map(u => [
        u.id,
        u.username,
        placeholderHash,
        u.role,
        1,
        u.created_at ? new Date(u.created_at) : new Date()
      ]);
      await conn.batch(
        'INSERT INTO users (id, username, password_hash, role, force_password_change, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        userValues
      );
    }

    if (entries.length > 0) {
      const entryValues = entries.map(e => [
        e.id,
        e.user_id,
        e.amount,
        e.description || null,
        String(e.entry_date).slice(0, 10),
        e.created_at ? new Date(e.created_at) : new Date()
      ]);
      await conn.batch(
        'INSERT INTO entries (id, user_id, amount, description, entry_date, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        entryValues
      );
    }

    await conn.commit();
  } catch (err) {
    try {
      await conn.rollback();
    } catch (rollbackErr) {
      console.error('Restore rollback error:', rollbackErr);
    }
    throw err;
  }
};

// GET /api/backup - export full database snapshot (admin only)
router.get('/', adminMiddleware, async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const users = await conn.query(
      'SELECT id, username, role, force_password_change, created_at FROM users ORDER BY id'
    );
    const entries = await conn.query(
      'SELECT id, user_id, amount, description, entry_date, created_at FROM entries ORDER BY id'
    );

    const backup = {
      version: 1,
      exported_at: new Date().toISOString(),
      users,
      entries
    };

    const date = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Disposition', `attachment; filename="repairfund-backup-${date}.json"`);
    res.setHeader('Content-Type', 'application/json');
    res.json(backup);
  } catch (err) {
    console.error('Backup error:', err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    if (conn) conn.end();
  }
});

// POST /api/backup/restore - restore database from backup JSON (admin only)
router.post('/restore', adminMiddleware, async (req, res) => {
  const { version, users, entries } = req.body;

  if (!Array.isArray(users) || !Array.isArray(entries)) {
    return res.status(400).json({ error: 'Invalid backup file: missing users or entries arrays' });
  }

  if (!users.some(u => u.role === 'admin')) {
    return res.status(400).json({ error: 'Backup must contain at least one admin user' });
  }

  for (const u of users) {
    if (!u.id || !u.username || !u.role) {
      return res.status(400).json({ error: 'Invalid backup: user records are malformed' });
    }
  }

  for (const e of entries) {
    if (!e.id || !e.user_id || e.amount === undefined || !e.entry_date) {
      return res.status(400).json({ error: 'Invalid backup: entry records are malformed' });
    }
  }

  let conn;
  try {
    // All restored users receive an unknown password and must be reset by an
    // administrator before they can sign in.
    const placeholderHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
    conn = await pool.getConnection();
    await restoreDatabase({ conn, users, entries, placeholderHash });

    res.json({
      success: true,
      usersRestored: users.length,
      entriesRestored: entries.length
    });
  } catch (err) {
    console.error('Restore error:', err);
    res.status(500).json({ error: 'Restore failed. Check server logs for details.' });
  } finally {
    if (conn) conn.end();
  }
});

export default router;
