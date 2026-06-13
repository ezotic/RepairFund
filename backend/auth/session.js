import jwt from 'jsonwebtoken';

export const AUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 24 * 60 * 60 * 1000
};

export const createAuthToken = (userId) => jwt.sign(
  {},
  process.env.JWT_SECRET,
  {
    subject: String(userId),
    expiresIn: '24h'
  }
);

export const setAuthCookie = (res, userId) => {
  const token = createAuthToken(userId);
  res.cookie('token', token, AUTH_COOKIE_OPTIONS);
  return token;
};

