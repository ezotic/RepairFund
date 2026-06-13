import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';

process.env.JWT_SECRET = 'test-secret-for-session-tests';

const { AUTH_COOKIE_OPTIONS, setAuthCookie } = await import('../auth/session.js');

test('sets a fresh identity-only authentication cookie', () => {
  const cookies = [];
  const res = {
    cookie(name, value, options) {
      cookies.push({ name, value, options });
    }
  };

  setAuthCookie(res, 42);

  assert.equal(cookies.length, 1);
  assert.equal(cookies[0].name, 'token');
  assert.deepEqual(cookies[0].options, AUTH_COOKIE_OPTIONS);

  const decoded = jwt.verify(cookies[0].value, process.env.JWT_SECRET);
  assert.equal(decoded.sub, '42');
  assert.equal(decoded.role, undefined);
  assert.equal(decoded.forceChange, undefined);
});

