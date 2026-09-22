export interface Config {
  port: number;
  dataDir: string;
  telegramToken: string | null;
  allowedUserIds: Set<number>;
  ownerChatId: number | null;
  relaySecret: string;
  openrouterKey: string | null;
  openrouterModel: string;
  /** Sent as HTTP-Referer to OpenRouter so usage shows up under this app. */
  appUrl: string;
  historyCap: number;
}

export const DEFAULT_MODEL = 'google/gemini-3.8-flash';

function idList(raw: string | undefined): Set<number> {
  const ids = (raw ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map(Number)
    .filter((n) => Number.isInteger(n));
  return new Set(ids);
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const relaySecret = env.RELAY_SECRET?.trim();
  if (!relaySecret) throw new Error('RELAY_SECRET is required');

  const owner = env.OWNER_CHAT_ID ? Number(env.OWNER_CHAT_ID) : NaN;
  return {
    port: Number(env.PORT ?? 3000),
    dataDir: env.DATA_DIR ?? './data',
    telegramToken: env.TELEGRAM_BOT_TOKEN?.trim() || null,
    allowedUserIds: idList(env.ALLOWED_TELEGRAM_USER_ID),
    ownerChatId: Number.isInteger(owner) ? owner : null,
    relaySecret,
    openrouterKey: env.OPENROUTER_API_KEY?.trim() || null,
    openrouterModel: env.OPENROUTER_MODEL?.trim() || DEFAULT_MODEL,
    appUrl: env.APP_URL?.trim() || 'https://github.com/jimmydenero/telegram-agent',
    historyCap: Number(env.HISTORY_CAP ?? 40),
  };
}
