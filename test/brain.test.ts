import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Brain, SYSTEM_PROMPT } from '../src/brain.js';

function stubFetch(handler: (url: string, init: RequestInit) => Response) {
  const original = globalThis.fetch;
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) =>
    handler(String(url), init ?? {})) as typeof fetch;
  return () => {
    globalThis.fetch = original;
  };
}

test('brain: sends OpenRouter headers, system prompt and history; returns content', async () => {
  const calls: { url: string; headers: Record<string, string>; body: any }[] = [];
  const restore = stubFetch((url, init) => {
    calls.push({ url, headers: init.headers as Record<string, string>, body: JSON.parse(String(init.body)) });
    return new Response(JSON.stringify({ choices: [{ message: { content: ' hi there ' }, finish_reason: 'stop' }] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  });
  try {
    const brain = new Brain({ apiKey: 'k', model: 'test/model', appUrl: 'https://example.test' });
    const out = await brain.reply([{ role: 'user', content: 'hello' }]);
    assert.equal(out, 'hi there');
    assert.equal(calls.length, 1);
    const seen = calls[0];
    assert.equal(seen.url, 'https://openrouter.ai/api/v1/chat/completions');
    assert.equal(seen.headers.Authorization, 'Bearer k');
    assert.equal(seen.headers['HTTP-Referer'], 'https://example.test');
    assert.equal(seen.headers['X-Title'], 'telegram-agent');
    assert.equal(seen.body.model, 'test/model');
    assert.deepEqual(seen.body.messages[0], { role: 'system', content: SYSTEM_PROMPT });
    assert.deepEqual(seen.body.messages[1], { role: 'user', content: 'hello' });
  } finally {
    restore();
  }
});

test('brain: non-2xx becomes an error with the status', async () => {
  const restore = stubFetch(() => new Response('{"error":{"message":"no credits"}}', { status: 402 }));
  try {
    const brain = new Brain({ apiKey: 'k', model: 'm', appUrl: 'u' });
    await assert.rejects(brain.reply([{ role: 'user', content: 'x' }]), /OpenRouter 402/);
  } finally {
    restore();
  }
});
