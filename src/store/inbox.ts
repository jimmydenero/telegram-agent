import type { Db } from '../db.js';

export interface InboxItem {
  id: number;
  text: string;
  created_at: string;
}

/** Messages the owner queued for Claude Code. Items stay until acked. */
export class InboxStore {
  constructor(private readonly db: Db) {}

  add(text: string): InboxItem {
    const row = this.db
      .prepare('INSERT INTO inbox (text) VALUES (?) RETURNING id, text, created_at')
      .get(text) as InboxItem;
    return row;
  }

  listUnacked(): InboxItem[] {
    return this.db
      .prepare('SELECT id, text, created_at FROM inbox WHERE acked_at IS NULL ORDER BY id')
      .all() as InboxItem[];
  }

  /** Returns false when the id is unknown or already acked. */
  ack(id: number): boolean {
    const info = this.db
      .prepare("UPDATE inbox SET acked_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ? AND acked_at IS NULL")
      .run(id);
    return info.changes > 0;
  }
}
