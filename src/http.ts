import { Hono } from 'hono';
import { bearerAuth } from 'hono/bearer-auth';
import type { Config } from './config.js';
import type { InboxStore } from './store/inbox.js';
import type { SettingsStore } from './store/settings.js';
import { LAST_CHAT_KEY } from './bot.js';

export interface HttpDeps {
  inbox: InboxStore;
  settings: SettingsStore;
  /** null when the Telegram bot is disabled */
  send: ((chatId: number, text: string) => Promise<void>) | null;
}

export function createApp(cfg: Config, deps: HttpDeps): Hono {
  const app = new Hono();
  const auth = bearerAuth({ token: cfg.relaySecret });
  app.use('/relay', auth);
  app.use('/inbox', auth);
  app.use('/inbox/*', auth);

  app.get('/healthz', (c) => c.json({ ok: true, bot: deps.send !== null }));

  app.post('/relay', async (c) => {
    const body = await c.req.json().catch(() => null);
    const text = typeof body?.text === 'string' ? body.text.trim() : '';
    if (!text) return c.json({ error: 'text is required' }, 400);
    if (!deps.send) return c.json({ error: 'telegram bot disabled' }, 503);

    const last = deps.settings.get(LAST_CHAT_KEY);
    const chatId = Number(body.chat_id ?? cfg.ownerChatId ?? last);
    if (!Number.isInteger(chatId)) return c.json({ error: 'no chat known yet; message the bot first or set OWNER_CHAT_ID' }, 409);

    await deps.send(chatId, text);
    return c.json({ ok: true, chat_id: chatId });
  });

  app.get('/inbox', (c) => c.json({ items: deps.inbox.listUnacked() }));

  app.post('/inbox/:id/ack', (c) => {
    const id = Number(c.req.param('id'));
    if (!Number.isInteger(id)) return c.json({ error: 'bad id' }, 400);
    return deps.inbox.ack(id) ? c.json({ ok: true, id }) : c.json({ error: 'not found' }, 404);
  });

  return app;
}
