import { Bot, type Api, type Context } from 'grammy';
import type { Config } from './config.js';
import type { Brain } from './brain.js';
import type { HistoryStore } from './store/history.js';
import type { InboxStore } from './store/inbox.js';
import type { SettingsStore } from './store/settings.js';
import { splitMessage } from './split.js';

export const LAST_CHAT_KEY = 'last_chat_id';

export interface BotDeps {
  history: HistoryStore;
  inbox: InboxStore;
  settings: SettingsStore;
  brain: Brain;
}

const HELP = [
  'Talk to me in plain text and I answer with Claude.',
  '/new - forget this conversation',
  '/cc <text> - queue text for Claude Code (or start a message with "cc:")',
  '/inbox - show what Claude Code has not picked up yet',
  '/help - this list',
].join('\n');

/** Sends `text` as one or more plain-text Telegram messages. */
export async function sendText(api: Api, chatId: number, text: string): Promise<void> {
  for (const chunk of splitMessage(text)) {
    await api.sendMessage(chatId, chunk, { link_preview_options: { is_disabled: true } });
  }
}

export function createBot(cfg: Config, deps: BotDeps): Bot {
  if (!cfg.telegramToken) throw new Error('createBot needs a token');
  const bot = new Bot(cfg.telegramToken);
  const { history, inbox, settings, brain } = deps;

  // Gate: only listed users get past this point.
  bot.use(async (ctx, next) => {
    const from = ctx.from;
    if (!from || !cfg.allowedUserIds.has(from.id)) {
      if (ctx.chat) await ctx.reply('This bot is private.');
      return;
    }
    if (ctx.chat) settings.set(LAST_CHAT_KEY, String(ctx.chat.id));
    await next();
  });

  const queue = async (ctx: Context, text: string) => {
    const body = text.trim();
    if (!body) return ctx.reply('Nothing to queue. Usage: /cc <text>');
    const item = inbox.add(body);
    return ctx.reply(`Queued for Claude Code as #${item.id}.`);
  };

  bot.command('start', (ctx) => ctx.reply(`Ready. Chat id: ${ctx.chat.id}\n\n${HELP}`));
  bot.command('help', (ctx) => ctx.reply(HELP));
  bot.command('new', (ctx) => {
    history.reset(ctx.chat.id);
    return ctx.reply('Fresh start.');
  });
  bot.command('cc', (ctx) => queue(ctx, ctx.match));
  bot.command('inbox', (ctx) => {
    const items = inbox.listUnacked();
    if (!items.length) return ctx.reply('Inbox is empty.');
    const lines = items.map((i) => `#${i.id} (${i.created_at.slice(0, 16).replace('T', ' ')}): ${i.text}`);
    return sendText(ctx.api, ctx.chat.id, lines.join('\n'));
  });

  bot.on('message:text', async (ctx) => {
    const text = ctx.message.text;
    if (/^cc:/i.test(text)) return queue(ctx, text.slice(3));

    const chatId = ctx.chat.id;
    await ctx.replyWithChatAction('typing');
    history.append(chatId, 'user', text);
    const reply = await brain.reply(history.load(chatId));
    if (reply.refused) return ctx.reply('Claude declined to answer that.');
    if (!reply.text) return ctx.reply('(empty reply)');
    history.append(chatId, 'assistant', reply.text);
    await sendText(ctx.api, chatId, reply.text);
  });

  bot.catch(async (err) => {
    console.error('bot error', err.error);
    const chat = err.ctx.chat;
    if (chat) await err.ctx.api.sendMessage(chat.id, 'Something went wrong; try again.').catch(() => {});
  });

  return bot;
}
