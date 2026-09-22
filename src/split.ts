export const TELEGRAM_MAX = 4096;

/**
 * Splits text into chunks no longer than `limit`, preferring to break at a
 * newline, then a space, then a hard cut. Empty input yields no chunks.
 */
export function splitMessage(text: string, limit = TELEGRAM_MAX): string[] {
  const out: string[] = [];
  let rest = text;
  while (rest.length > limit) {
    let cut = rest.lastIndexOf('\n', limit);
    if (cut < limit / 2) cut = rest.lastIndexOf(' ', limit);
    if (cut < limit / 2) cut = limit;
    out.push(rest.slice(0, cut).trimEnd());
    rest = rest.slice(cut).trimStart();
  }
  if (rest.length) out.push(rest);
  return out;
}
