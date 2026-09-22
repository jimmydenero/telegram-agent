import Anthropic from '@anthropic-ai/sdk';
import type { Effort } from './config.js';

export const SYSTEM_PROMPT = `You are the owner's personal assistant, reached from their phone over Telegram.
Be concise and direct: short paragraphs, plain text, no Markdown tables or headers. Telegram renders your reply as plain text.
You can hand work to "Claude Code", the coding agent running on the owner's Mac: anything the owner sends with /cc or a "cc:" prefix lands in an inbox that Claude Code polls. If a request needs files, a repo, or a terminal, say so and suggest the owner queue it with /cc. Claude Code can also push notes back to this chat.
Keep conversation history in mind; the owner may pick up a thread hours later.`;

export interface Reply {
  text: string;
  refused: boolean;
}

/** Thin wrapper around the Messages API for one chat turn. */
export class Brain {
  constructor(
    private readonly client: Anthropic,
    private readonly model: string,
    private readonly effort: Effort,
  ) {}

  async reply(history: Anthropic.Beta.BetaMessageParam[]): Promise<Reply> {
    const message = await this.client.beta.messages
      .stream({
        model: this.model,
        max_tokens: 16000,
        system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
        messages: history,
        thinking: { type: 'adaptive' },
        output_config: { effort: this.effort },
        // Server-side refusal fallback: a policy decline is re-run on Anthropic's recommended model.
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
      })
      .finalMessage();

    if (message.stop_reason === 'refusal') return { text: '', refused: true };

    let text = message.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim();
    if (message.stop_reason === 'max_tokens') text += '\n\n[cut off at max_tokens]';
    return { text, refused: false };
  }
}
