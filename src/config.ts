export type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

export interface Config {
  port: number;
  dataDir: string;
  telegramToken: string | null;
  allowedUserIds: Set<number>;
  ownerChatId: number | null;
  relaySecret: string;
  model: string;
  effort: Effort;
  historyCap: number;
}

const EFFORTS: Effort[] = ['low', 'medium', 'high', 'xhigh', 'max'];

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

  const effort = (env.ANTHROPIC_EFFORT ?? 'medium') as Effort;
  if (!EFFORTS.includes(effort)) throw new Error(`ANTHROPIC_EFFORT must be one of ${EFFORTS.join(', ')}`);

  const owner = env.OWNER_CHAT_ID ? Number(env.OWNER_CHAT_ID) : NaN;
  return {
    port: Number(env.PORT ?? 3000),
    dataDir: env.DATA_DIR ?? './data',
    telegramToken: env.TELEGRAM_BOT_TOKEN?.trim() || null,
    allowedUserIds: idList(env.ALLOWED_TELEGRAM_USER_ID),
    ownerChatId: Number.isInteger(owner) ? owner : null,
    relaySecret,
    model: env.ANTHROPIC_MODEL?.trim() || 'claude-opus-5',
    effort,
    historyCap: Number(env.HISTORY_CAP ?? 40),
  };
}
