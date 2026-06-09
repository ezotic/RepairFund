import express from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import pool from '../db/pool.js';
import adminMiddleware from '../middleware/admin.js';

const router = express.Router();

const generateTempPassword = () => crypto.randomBytes(8).toString('hex');

const parseId = (raw) => {
  const id = parseInt(raw, 10);
  return Number.isInteger(id) && id > 0 ? id : null;
};

// GET /api/users - List all users (admin only)
router.get('/', adminMiddleware, async (req, res) => {
  try {
    let conn;
    try {
      conn = await pool.getConnection();
      const users = await conn.query('SELECT id, username, role, force_password_change, created_at FROM users ORDER BY created_at DESC');
      res.json(users);
    } finally {
      if (conn) conn.end();
    }
  } catch (err) {
    console.error('Get users error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/users - Create new user (admin only)
router.post('/', adminMiddleware, async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    let conn;
    try {
      conn = await pool.getConnection();
      const result = await conn.query(
        'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)',
        [username, hashedPassword, 'user']
      );

      res.json({ success: true });
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ error: 'Username already exists' });
      }
      throw err;
    } finally {
      if (conn) conn.end();
    }
  } catch (err) {
    console.error('Create user error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/users/:id - Delete user (admin only)
router.delete('/:id', adminMiddleware, async (req, res) => {
  try {
    const userId = parseId(req.params.id);
    if (!userId) return res.status(400).json({ error: 'Invalid user ID' });

    if (userId === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    let conn;
    try {
      conn = await pool.getConnection();
      await conn.query('DELETE FROM users WHERE id = ?', [userId]);
      res.json({ success: true });
    } finally {
      if (conn) conn.end();
    }
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/users/:id/role - Toggle user role between 'user' and 'admin' (admin only)
router.put('/:id/role', adminMiddleware, async (req, res) => {
  try {
    const userId = parseId(req.params.id);
    if (!userId) return res.status(400).json({ error: 'Invalid user ID' });

    if (userId === req.user.id) {
      return res.status(400).json({ error: 'Cannot change your own role' });
    }

    let conn;
    try {
      conn = await pool.getConnection();
      const users = await conn.query('SELECT id, role FROM users WHERE id = ?', [userId]);

      if (users.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      const newRole = users[0].role === 'admin' ? 'user' : 'admin';
      await conn.query('UPDATE users SET role = ? WHERE id = ?', [newRole, userId]);

      res.json({ success: true, newRole });
    } finally {
      if (conn) conn.end();
    }
  } catch (err) {
    console.error('Toggle role error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/users/:id/reset-password - Reset user password (admin only)
router.post('/:id/reset-password', adminMiddleware, async (req, res) => {
  try {
    const userId = parseId(req.params.id);
    if (!userId) return res.status(400).json({ error: 'Invalid user ID' });
    const tempPassword = generateTempPassword();
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    let conn;
    try {
      conn = await pool.getConnection();
      await conn.query(
        'UPDATE users SET password_hash = ?, force_password_change = TRUE WHERE id = ?',
        [hashedPassword, userId]
      );

      res.json({
        success: true,
        tempPassword: tempPassword
      });
    } finally {
      if (conn) conn.end();
    }
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
