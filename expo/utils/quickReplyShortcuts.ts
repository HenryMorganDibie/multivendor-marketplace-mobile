// Pure, cursor-aware slash-shortcut detection shared by both vendor chat
// composers (order chat + pre-order chat), so the two screens can't drift
// on what counts as an active "/shortcut" query.

export interface ActiveSlashQuery {
  /** Index of the '/' that starts the active token. */
  start: number;
  /** Index right after the token (exclusive). */
  end: number;
  /** Text after the '/', e.g. "pickup" for the token "/pickup". */
  query: string;
}

/**
 * Finds the whitespace-delimited token touching `cursor` and returns it as
 * an active slash query only if that token starts with '/'. This is cursor-
 * aware by construction: a '/' anywhere else in the text (a URL, a date, a
 * fraction, an earlier already-typed shortcut) is a different token and is
 * never considered, because the token boundaries are whitespace/string
 * edges nearest to the cursor, not the first/last '/' in the whole string.
 *
 * A '/' only starts a new token when the character immediately before it is
 * whitespace (space, tab, or newline -- so a shortcut on a fresh line still
 * activates) or it is the very first character of the composer. Any other
 * adjacent character -- a letter, digit, or punctuation like "Hello,/pickup"
 * -- attaches the '/' to that surrounding run instead, the same as
 * "site.com/pickup" or "word/pickup": one non-whitespace token that does not
 * start with '/', so it does not activate. This applies uniformly regardless
 * of where inside the token the cursor sits (mid-token or at either edge),
 * and the query is always the whole matched token, not just the text to the
 * left of the cursor.
 */
export function getActiveSlashQuery(text: string, cursor: number): ActiveSlashQuery | null {
  const pos = Math.max(0, Math.min(cursor, text.length));

  let start = pos;
  while (start > 0 && !/\s/.test(text[start - 1])) start--;

  let end = pos;
  while (end < text.length && !/\s/.test(text[end])) end++;

  const token = text.slice(start, end);
  if (!token.startsWith('/')) return null;

  return { start, end, query: token.slice(1) };
}

/** Case-insensitive prefix match against each reply's shortcut. */
export function filterQuickRepliesByQuery<T extends { shortcut: string }>(
  quickReplies: T[],
  query: string
): T[] {
  const q = query.toLowerCase();
  return quickReplies.filter((r) => r.shortcut.toLowerCase().startsWith(q));
}

/**
 * Replaces exactly the active token with `replacement`, preserving any text
 * before and after it, and returns the cursor position right after the
 * inserted text so the caller can restore it.
 */
export function applyQuickReplySelection(
  text: string,
  activeQuery: ActiveSlashQuery,
  replacement: string
): { text: string; cursor: number } {
  const nextText = text.slice(0, activeQuery.start) + replacement + text.slice(activeQuery.end);
  return { text: nextText, cursor: activeQuery.start + replacement.length };
}
