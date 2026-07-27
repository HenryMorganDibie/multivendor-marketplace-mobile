import React from 'react';
import { Text, type TextStyle, type StyleProp } from 'react-native';

/**
 * Split `content` around case-insensitive occurrences of `term` and render
 * matched segments wrapped in a highlight style. Used by the in-chat
 * message search overlay to show inline match emphasis.
 *
 * Structured so future searchable surfaces (image captions, document names,
 * invoice references, AI snippets) can reuse the same highlighter by
 * passing their own base + highlight styles.
 */
export function renderHighlightedText(
  content: string,
  term: string,
  baseStyle?: StyleProp<TextStyle>,
  highlightStyle?: StyleProp<TextStyle>,
): React.ReactNode {
  const trimmed = term.trim();
  if (!trimmed || !content) return content;

  const lower = content.toLowerCase();
  const needle = trimmed.toLowerCase();
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  let idx = lower.indexOf(needle, cursor);
  let key = 0;

  while (idx !== -1) {
    if (idx > cursor) {
      parts.push(<Text key={`p-${key++}`} style={baseStyle}>{content.slice(cursor, idx)}</Text>);
    }
    parts.push(
      <Text key={`h-${key++}`} style={[baseStyle, highlightStyle]}>
        {content.slice(idx, idx + needle.length)}
      </Text>,
    );
    cursor = idx + needle.length;
    idx = lower.indexOf(needle, cursor);
  }
  if (cursor < content.length) {
    parts.push(<Text key={`p-${key++}`} style={baseStyle}>{content.slice(cursor)}</Text>);
  }
  return parts;
}

/**
 * Returns true if a chat message is searchable + matches the given term.
 * Currently scans text content; structured so future message types
 * (media captions, document filenames, invoice memos, order references)
 * can extend matching without changing call sites.
 */
export function messageMatchesQuery(
  message: { type?: string; content?: unknown },
  term: string,
): boolean {
  const trimmed = term.trim().toLowerCase();
  if (!trimmed) return false;
  if (message.type !== 'text') return false;
  if (typeof message.content !== 'string') return false;
  return message.content.toLowerCase().includes(trimmed);
}
