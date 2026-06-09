import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import pool from '../db/pool.js';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    let conn;
    try {
      conn = await pool.getConnection();
      const user = await conn.query('SELECT * FROM users WHERE username = ?', [username]);

      if (user.length === 0) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const userRecord = user[0];
      const match = await bcrypt.compare(password, userRecord.password_hash);

      if (!match) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const token = jwt.sign(
        {
          id: userRecord.id,
          username: userRecord.username,
          role: userRecord.role,
          forceChange: userRecord.force_password_change
        },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000
      });

      res.json({
        success: true,
        forceChange: userRecord.force_password_change
      });
    } finally {
      if (conn) conn.end();
    }
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, (req, res) => {
  res.json({
    id: req.user.id,
    username: req.user.username,
    role: req.user.role
  });
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ success: true });
});

// POST /api/auth/change-password
router.post('/change-password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password required' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters' });
    }

    let conn;
    try {
      conn = await pool.getConnection();
      const user = await conn.query('SELECT * FROM users WHERE id = ?', [userId]);

      if (user.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      const match = await bcrypt.compare(currentPassword, user[0].password_hash);
      if (!match) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await conn.query(
        'UPDATE users SET password_hash = ?, force_password_change = FALSE WHERE id = ?',
        [hashedPassword, userId]
      );

      res.json({ success: true });
    } finally {
      if (conn) conn.end();
    }
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
