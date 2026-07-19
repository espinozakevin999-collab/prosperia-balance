import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeCloudTransactions } from '../src/lib/sync.js';

test('cloud sync preserves local-only and remote-only transactions', () => {
  const local = [{ id: 'local', amount: 100 }];
  const remote = [{ id: 'remote', amount: 200 }];
  const result = mergeCloudTransactions(local, remote);

  assert.deepEqual(result.merged.map((item) => item.id), ['remote', 'local']);
  assert.deepEqual(result.pendingUpload.map((item) => item.id), ['local']);
});

test('cloud sync keeps the remote version when an id already exists', () => {
  const local = [{ id: 'same', amount: 100 }];
  const remote = [{ id: 'same', amount: 250 }];
  const result = mergeCloudTransactions(local, remote);

  assert.equal(result.merged.length, 1);
  assert.equal(result.merged[0].amount, 250);
  assert.equal(result.pendingUpload.length, 0);
});
