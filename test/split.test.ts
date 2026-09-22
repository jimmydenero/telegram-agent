import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitMessage, TELEGRAM_MAX } from '../src/split.js';

test('short text is a single chunk; empty text is none', () => {
  assert.deepEqual(splitMessage('hello'), ['hello']);
  assert.deepEqual(splitMessage(''), []);
});

test('splits at newlines under the limit', () => {
  const para = 'x'.repeat(30);
  const text = Array(10).fill(para).join('\n');
  const chunks = splitMessage(text, 100);
  assert.ok(chunks.every((c) => c.length <= 100));
  assert.ok(chunks.every((c) => !c.startsWith('\n') && !c.endsWith('\n')));
  assert.equal(chunks.join('\n'), text);
});

test('falls back to spaces, then hard cuts', () => {
  const words = splitMessage('word '.repeat(50).trim(), 23);
  assert.ok(words.every((c) => c.length <= 23 && !c.startsWith(' ')));
  const solid = splitMessage('a'.repeat(10_000));
  assert.ok(solid.every((c) => c.length <= TELEGRAM_MAX));
  assert.equal(solid.join(''), 'a'.repeat(10_000));
});
