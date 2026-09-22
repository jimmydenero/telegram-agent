import type { Db } from '../db.js';

/** Tiny key/value table for runtime state such as the last chat that spoke to the bot. */
export class SettingsStore {
  constructor(private readonly db: Db) {}

  get(key: string): string | null {
    const row = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
    return row?.value ?? null;
  }

  set(key: string, value: string): void {
    this.db
      .prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
      .run(key, value);
  }
}
