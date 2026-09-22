export type Role = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  role: Role;
  content: string;
}

export const SYSTEM_PROMPT = `You are the owner's personal assistant, reached from their phone over Telegram.
Be concise and direct: short paragraphs, plain text, no Markdown tables or headers. Telegram renders your reply as plain text.
You can hand work to "Claude Code", the coding agent running on the owner's Mac: anything the owner sends with /cc or a "cc:" prefix lands in an inbox that Claude Code polls. If a request needs files, a repo, or a terminal, say so and suggest the owner queue it with /cc. Claude Code can also push notes back to this chat.
Keep conversation history in mind; the owner may pick up a thread hours later.`;

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

export interface BrainOptions {
  apiKey: string;
  model: string;
  appUrl: string;
  timeoutMs?: number;
}

/** One chat turn against OpenRouter's OpenAI-compatible chat completions endpoint. */
export class Brain {
  constructor(private readonly opts: BrainOptions) {}

  get model(): string {
    return this.opts.model;
  }

  async reply(history: ChatMessage[]): Promise<string> {
    const res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.opts.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': this.opts.appUrl,
        'X-Title': 'telegram-agent',
      },
      body: JSON.stringify({
        model: this.opts.model,
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...history],
        max_tokens: 4096,
      }),
      signal: AbortSignal.timeout(this.opts.timeoutMs ?? 120_000),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`OpenRouter ${res.status}: ${body.slice(0, 300)}`);
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string | null }; finish_reason?: string }[];
      error?: { message?: string };
    };
    if (data.error) throw new Error(`OpenRouter: ${data.error.message ?? 'unknown error'}`);

    const choice = data.choices?.[0];
    let text = (choice?.message?.content ?? '').trim();
    if (choice?.finish_reason === 'length') text += '\n\n[cut off at max_tokens]';
    return text;
  }
}
