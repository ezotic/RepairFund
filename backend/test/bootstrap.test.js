import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { bootstrapAdmin } from '../db/bootstrap.js';
import pool from '../db/pool.js';

after(async () => {
  await pool.end();
});

const createPool = (queryResults) => {
  const queries = [];
  let ended = false;
  const conn = {
    async query(sql, params) {
      queries.push({ sql, params });
      return queryResults.shift();
    },
    end() {
      ended = true;
    }
  };

  return {
    pool: {
      async getConnection() {
        return conn;
      }
    },
    queries,
    wasEnded: () => ended
  };
};

test('creates a forced-change admin when no admin exists', async () => {
  const fake = createPool([[], [], { affectedRows: 1 }]);

  await bootstrapAdmin({
    dbPool: fake.pool,
    initialPassword: 'initial-password',
    hashPassword: async () => 'hashed-password'
  });

  assert.match(fake.queries[2].sql, /INSERT INTO users/);
  assert.deepEqual(fake.queries[2].params, ['admin', 'hashed-password', 'admin']);
  assert.equal(fake.wasEnded(), true);
});

test('does not overwrite an existing non-legacy admin', async () => {
  const fake = createPool([[], [{ id: 7 }]]);
  let hashCalled = false;

  await bootstrapAdmin({
    dbPool: fake.pool,
    hashPassword: async () => {
      hashCalled = true;
      return 'unused';
    }
  });

  assert.equal(fake.queries.length, 2);
  assert.equal(hashCalled, false);
  assert.equal(fake.wasEnded(), true);
});

test('migrates the legacy admin hash and forces a password change', async () => {
  const fake = createPool([[{ id: 3 }], { affectedRows: 1 }]);

  await bootstrapAdmin({
    dbPool: fake.pool,
    initialPassword: 'replacement-password',
    hashPassword: async () => 'replacement-hash'
  });

  assert.match(fake.queries[1].sql, /force_password_change = TRUE/);
  assert.deepEqual(fake.queries[1].params, ['replacement-hash', 3]);
});

test('requires a strong enough initial password when bootstrapping', async () => {
  const fake = createPool([[], []]);

  await assert.rejects(
    bootstrapAdmin({
      dbPool: fake.pool,
      initialPassword: 'short',
      hashPassword: async () => 'unused'
    }),
    /at least 8 characters/
  );
});
