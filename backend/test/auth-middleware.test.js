import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { createAuthMiddleware } from '../middleware/auth.js';
import adminMiddleware from '../middleware/admin.js';
import pool from '../db/pool.js';

after(async () => {
  await pool.end();
});

const createResponse = () => ({
  statusCode: 200,
  body: null,
  clearedCookie: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
  clearCookie(name) {
    this.clearedCookie = name;
  }
});

const createPool = (users) => ({
  async getConnection() {
    return {
      async query() {
        return users;
      },
      end() {}
    };
  }
});

const request = (overrides = {}) => ({
  cookies: { token: 'valid-token' },
  baseUrl: '/api/entries',
  path: '/',
  ...overrides
});

test('rejects and clears the token for a deleted user', async () => {
  const middleware = createAuthMiddleware({
    dbPool: createPool([]),
    verifyToken: () => ({ sub: '42' })
  });
  const req = request();
  const res = createResponse();

  await middleware(req, res, () => assert.fail('next should not be called'));

  assert.equal(res.statusCode, 401);
  assert.equal(res.clearedCookie, 'token');
});

test('loads the current database role instead of trusting the token', async () => {
  const middleware = createAuthMiddleware({
    dbPool: createPool([{
      id: 42,
      username: 'former-admin',
      role: 'user',
      force_password_change: false
    }]),
    verifyToken: () => ({ sub: '42', role: 'admin' })
  });
  const req = request();
  const res = createResponse();
  let nextCalled = false;

  await middleware(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(req.user.role, 'user');
});

test('immediately denies admin access after a database demotion', async () => {
  const middleware = createAuthMiddleware({
    dbPool: createPool([{
      id: 42,
      username: 'former-admin',
      role: 'user',
      force_password_change: false
    }]),
    verifyToken: () => ({ sub: '42', role: 'admin' })
  });
  const req = request();
  const res = createResponse();

  await middleware(req, res, () => {
    adminMiddleware(req, res, () => assert.fail('admin next should not be called'));
  });

  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.body, { error: 'Admin access required' });
});

test('restricts a reset user to the password-change route', async () => {
  const middleware = createAuthMiddleware({
    dbPool: createPool([{
      id: 42,
      username: 'reset-user',
      role: 'user',
      force_password_change: true
    }]),
    verifyToken: () => ({ sub: '42' })
  });
  const blockedRes = createResponse();

  await middleware(
    request(),
    blockedRes,
    () => assert.fail('next should not be called')
  );

  assert.equal(blockedRes.statusCode, 403);
  assert.equal(blockedRes.body.forceChange, true);

  const allowedReq = request({
    baseUrl: '/api/auth',
    path: '/change-password'
  });
  let nextCalled = false;

  await middleware(allowedReq, createResponse(), () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
});
