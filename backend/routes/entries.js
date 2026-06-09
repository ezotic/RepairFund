import express from 'express';
import pool from '../db/pool.js';

const router = express.Router();

// GET /api/entries - Get all entries (user auth required)
router.get('/', async (req, res) => {
  try {
    let conn;
    try {
      conn = await pool.getConnection();
      const entries = await conn.query(`
        SELECT e.id, e.user_id, e.amount, e.description, e.entry_date, e.created_at, u.username
        FROM entries e
        JOIN users u ON e.user_id = u.id
        ORDER BY e.entry_date DESC, e.created_at DESC
      `);
      res.json(entries);
    } finally {
      if (conn) conn.end();
    }
  } catch (err) {
    console.error('Get entries error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/entries/summary - Get total fund balance
router.get('/summary', async (req, res) => {
  try {
    let conn;
    try {
      conn = await pool.getConnection();
      const result = await conn.query('SELECT COALESCE(SUM(amount), 0) as total FROM entries');
      res.json({ total: parseFloat(result[0].total) || 0 });
    } finally {
      if (conn) conn.end();
    }
  } catch (err) {
    console.error('Get summary error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/entries - Create entry
router.post('/', async (req, res) => {
  try {
    const { amount, description, entryDate } = req.body;
    const userId = req.user.id;

    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Valid amount required' });
    }

    if (!entryDate) {
      return res.status(400).json({ error: 'Entry date required' });
    }

    let conn;
    try {
      conn = await pool.getConnection();
      const result = await conn.query(
        'INSERT INTO entries (user_id, amount, description, entry_date) VALUES (?, ?, ?, ?)',
        [userId, amount, description || null, entryDate]
      );

      res.json({ success: true });
    } finally {
      if (conn) conn.end();
    }
  } catch (err) {
    console.error('Create entry error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/entries/:id - Delete entry
router.delete('/:id', async (req, res) => {
  try {
    const entryId = req.params.id;
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';

    let conn;
    try {
      conn = await pool.getConnection();

      // Get entry to check ownership
      const entry = await conn.query('SELECT user_id FROM entries WHERE id = ?', [entryId]);
      if (entry.length === 0) {
        return res.status(404).json({ error: 'Entry not found' });
      }

      // Only allow owner or admin to delete
      if (entry[0].user_id !== userId && !isAdmin) {
        return res.status(403).json({ error: 'Cannot delete entry' });
      }

      await conn.query('DELETE FROM entries WHERE id = ?', [entryId]);
      res.json({ success: true });
    } finally {
      if (conn) conn.end();
    }
  } catch (err) {
    console.error('Delete entry error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
