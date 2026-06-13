import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { changePassword } from '../routes/auth.js';
import pool from '../db/pool.js';

after(async () => {
  await pool.end();
});

test('refreshes the authentication cookie after changing a password', async () => {
  const queries = [];
  let connectionEnded = false;
  const dbPool = {
    async getConnection() {
      return {
        async query(sql, params) {
          queries.push({ sql, params });
          if (sql.startsWith('SELECT')) {
            return [{ id: 42, password_hash: 'old-hash' }];
          }
          return { affectedRows: 1 };
        },
        end() {
          connectionEnded = true;
        }
      };
    }
  };
  let issuedForUserId = null;
  const response = {
    body: null,
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };
  const handler = changePassword({
    dbPool,
    comparePassword: async () => true,
    hashPassword: async () => 'new-hash',
    issueAuthCookie: (_res, userId) => {
      issuedForUserId = userId;
    }
  });

  await handler({
    body: {
      currentPassword: 'old-password',
      newPassword: 'new-password'
    },
    user: { id: 42 }
  }, response);

  assert.match(queries[1].sql, /force_password_change = FALSE/);
  assert.deepEqual(queries[1].params, ['new-hash', 42]);
  assert.equal(issuedForUserId, 42);
  assert.deepEqual(response.body, { success: true });
  assert.equal(connectionEnded, true);
});

