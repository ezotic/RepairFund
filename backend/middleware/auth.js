import jwt from 'jsonwebtoken';
import pool from '../db/pool.js';

const clearAuthCookie = (res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  });
};

export const createAuthMiddleware = ({
  dbPool = pool,
  verifyToken = (token) => jwt.verify(token, process.env.JWT_SECRET)
} = {}) => async (req, res, next) => {
  const token = req.cookies.token;

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  let conn;
  try {
    const decoded = verifyToken(token);
    const userId = Number(decoded.sub);

    if (!Number.isInteger(userId) || userId < 1) {
      clearAuthCookie(res);
      return res.status(401).json({ error: 'Invalid token' });
    }

    conn = await dbPool.getConnection();
    const users = await conn.query(
      'SELECT id, username, role, force_password_change FROM users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      clearAuthCookie(res);
      return res.status(401).json({ error: 'Account no longer exists' });
    }

    const user = users[0];
    req.user = {
      id: user.id,
      username: user.username,
      role: user.role,
      forceChange: Boolean(user.force_password_change)
    };

    // Check if password change is forced
    if (req.user.forceChange && req.baseUrl === '/api/auth' && req.path !== '/change-password') {
      return res.status(403).json({ error: 'Password change required', forceChange: true });
    }

    if (req.user.forceChange && req.baseUrl !== '/api/auth') {
      return res.status(403).json({ error: 'Password change required', forceChange: true });
    }

    next();
  } catch (err) {
    if (err.name !== 'JsonWebTokenError' && err.name !== 'TokenExpiredError') {
      console.error('Authentication error:', err);
      return res.status(500).json({ error: 'Server error' });
    }

    clearAuthCookie(res);
    return res.status(401).json({ error: 'Invalid token' });
  } finally {
    if (conn) conn.end();
  }
};

const authMiddleware = createAuthMiddleware();

export default authMiddleware;
