import jwt from 'jsonwebtoken';

const authMiddleware = (req, res, next) => {
  const token = req.cookies.token;

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;

    // Check if password change is forced
    if (decoded.forceChange && !req.originalUrl.includes('/change-password') && !req.originalUrl.includes('/logout')) {
      return res.status(403).json({ error: 'Password change required', forceChange: true });
    }

    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

export default authMiddleware;
