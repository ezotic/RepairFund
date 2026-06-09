import express from 'express';
import pool from '../db/pool.js';
import adminMiddleware from '../middleware/admin.js';

const router = express.Router();

// GET /api/backup - export full database snapshot (admin only)
router.get('/', adminMiddleware, async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const users = await conn.query(
      'SELECT id, username, password_hash, role, force_password_change, created_at FROM users ORDER BY id'
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
    if (!u.id || !u.username || !u.password_hash || !u.role) {
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
    conn = await pool.getConnection();
    await conn.beginTransaction();

    await conn.query('SET FOREIGN_KEY_CHECKS=0');
    await conn.query('TRUNCATE TABLE entries');
    await conn.query('TRUNCATE TABLE users');

    if (users.length > 0) {
      const userValues = users.map(u => [
        u.id,
        u.username,
        u.password_hash,
        u.role,
        u.force_password_change ? 1 : 0,
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

    await conn.query('SET FOREIGN_KEY_CHECKS=1');
    await conn.commit();

    res.json({
      success: true,
      usersRestored: users.length,
      entriesRestored: entries.length
    });
  } catch (err) {
    if (conn) {
      try {
        await conn.query('SET FOREIGN_KEY_CHECKS=1');
        await conn.rollback();
      } catch (_) {}
    }
    console.error('Restore error:', err);
    res.status(500).json({ error: 'Restore failed: ' + err.message });
  } finally {
    if (conn) conn.end();
  }
});

export default router;
