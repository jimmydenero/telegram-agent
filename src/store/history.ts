import type { ChatMessage } from '../brain.js';
import type { Db } from '../db.js';

type Role = 'user' | 'assistant';

/** Per-chat conversation history, capped to the newest `cap` messages. */
export class HistoryStore {
  constructor(
    private readonly db: Db,
    private readonly cap: number,
  ) {}

  load(chatId: number): ChatMessage[] {
    const rows = this.db
      .prepare('SELECT role, content FROM messages WHERE chat_id = ? ORDER BY id')
      .all(chatId) as { role: Role; content: string }[];
    // The API requires the first message to be from the user.
    while (rows.length && rows[0].role !== 'user') rows.shift();
    return rows.map((r) => ({ role: r.role, content: r.content }));
  }

  append(chatId: number, role: Role, content: string): void {
    this.db.prepare('INSERT INTO messages (chat_id, role, content) VALUES (?, ?, ?)').run(chatId, role, content);
    this.db
      .prepare(
        `DELETE FROM messages WHERE chat_id = ? AND id NOT IN (
           SELECT id FROM messages WHERE chat_id = ? ORDER BY id DESC LIMIT ?
         )`,
      )
      .run(chatId, chatId, this.cap);
  }

  reset(chatId: number): void {
    this.db.prepare('DELETE FROM messages WHERE chat_id = ?').run(chatId);
  }
}
