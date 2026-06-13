import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { restoreDatabase } from '../routes/backup.js';
import pool from '../db/pool.js';

after(async () => {
  await pool.end();
});

const backup = {
  users: [{
    id: 1,
    username: 'admin',
    role: 'admin',
    created_at: '2026-01-01T00:00:00.000Z'
  }],
  entries: [{
    id: 1,
    user_id: 1,
    amount: '10.00',
    description: 'Test',
    entry_date: '2026-01-02',
    created_at: '2026-01-02T00:00:00.000Z'
  }]
};

test('restores with transactional deletes and foreign keys enabled', async () => {
  const calls = [];
  const conn = {
    async beginTransaction() {
      calls.push('begin');
    },
    async query(sql) {
      calls.push(sql);
    },
    async batch(sql) {
      calls.push(sql);
    },
    async commit() {
      calls.push('commit');
    },
    async rollback() {
      calls.push('rollback');
    }
  };

  await restoreDatabase({
    conn,
    ...backup,
    placeholderHash: 'locked-hash'
  });

  assert.deepEqual(calls.slice(0, 3), [
    'begin',
    'DELETE FROM entries',
    'DELETE FROM users'
  ]);
  assert.equal(calls.at(-1), 'commit');
  assert.equal(calls.includes('rollback'), false);
  assert.equal(calls.some(call => /TRUNCATE|FOREIGN_KEY_CHECKS/.test(call)), false);
});

test('rolls back deletions when a restore insert fails', async () => {
  const calls = [];
  const conn = {
    async beginTransaction() {
      calls.push('begin');
    },
    async query(sql) {
      calls.push(sql);
    },
    async batch() {
      calls.push('batch');
      throw new Error('insert failed');
    },
    async commit() {
      calls.push('commit');
    },
    async rollback() {
      calls.push('rollback');
    }
  };

  await assert.rejects(
    restoreDatabase({
      conn,
      ...backup,
      placeholderHash: 'locked-hash'
    }),
    /insert failed/
  );

  assert.equal(calls.includes('rollback'), true);
  assert.equal(calls.includes('commit'), false);
});

