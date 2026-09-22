import Anthropic from '@anthropic-ai/sdk';
import { serve } from '@hono/node-server';
import { loadConfig } from './config.js';
import { openDb } from './db.js';
import { HistoryStore } from './store/history.js';
import { InboxStore } from './store/inbox.js';
import { SettingsStore } from './store/settings.js';
import { Brain } from './brain.js';
import { createBot, sendText } from './bot.js';
import { createApp } from './http.js';

const cfg = loadConfig();
const db = openDb(cfg.dataDir);
const history = new HistoryStore(db, cfg.historyCap);
const inbox = new InboxStore(db);
const settings = new SettingsStore(db);

let bot: ReturnType<typeof createBot> | null = null;
if (cfg.telegramToken) {
  const brain = new Brain(new Anthropic(), cfg.model, cfg.effort);
  bot = createBot(cfg, { history, inbox, settings, brain });
  if (!cfg.allowedUserIds.size) console.warn('ALLOWED_TELEGRAM_USER_ID is empty; the bot will refuse everyone');
} else {
  console.warn('TELEGRAM_BOT_TOKEN missing, bot disabled');
}

const app = createApp(cfg, {
  inbox,
  settings,
  send: bot ? (chatId, text) => sendText(bot!.api, chatId, text) : null,
});

const server = serve({ fetch: app.fetch, port: cfg.port }, (info) => {
  console.log(`http listening on :${info.port} (model ${cfg.model}, effort ${cfg.effort}, data ${cfg.dataDir})`);
});

if (bot) {
  bot.api
    .setMyCommands([
      { command: 'new', description: 'Forget this conversation' },
      { command: 'cc', description: 'Queue text for Claude Code' },
      { command: 'inbox', description: 'Show unacked inbox items' },
      { command: 'help', description: 'List commands' },
    ])
    .catch((e) => console.warn('setMyCommands failed', e));
  bot.start({ onStart: (me) => console.log(`telegram polling as @${me.username}`) }).catch((e) => {
    console.error('bot stopped', e);
  });
}

const shutdown = () => {
  console.log('shutting down');
  server.close();
  const stop = bot ? bot.stop() : Promise.resolve();
  stop.finally(() => {
    db.close();
    process.exit(0);
  });
};
process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
