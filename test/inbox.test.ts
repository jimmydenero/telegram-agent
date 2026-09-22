import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../src/db.js';
import { InboxStore } from '../src/store/inbox.js';
import { HistoryStore } from '../src/store/history.js';

test('inbox: add, list, ack round trip', () => {
  const inbox = new InboxStore(openDb(':memory:'));
  const a = inbox.add('first');
  const b = inbox.add('second');
  assert.deepEqual(inbox.listUnacked().map((i) => i.id), [a.id, b.id]);
  assert.equal(typeof a.created_at, 'string');

  assert.equal(inbox.ack(a.id), true);
  assert.deepEqual(inbox.listUnacked().map((i) => i.text), ['second']);

  assert.equal(inbox.ack(a.id), false, 'double ack is a no-op');
  assert.equal(inbox.ack(999), false, 'unknown id');
});

test('history: caps at N messages and always starts with a user turn', () => {
  const history = new HistoryStore(openDb(':memory:'), 4);
  for (let i = 0; i < 3; i++) {
    history.append(7, 'user', `q${i}`);
    history.append(7, 'assistant', `a${i}`);
  }
  const rows = history.load(7);
  assert.ok(rows.length <= 4);
  assert.equal(rows[0].role, 'user');
  assert.equal(rows.at(-1)?.content, 'a2');

  history.reset(7);
  assert.deepEqual(history.load(7), []);
});
