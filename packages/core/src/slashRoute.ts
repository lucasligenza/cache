import type { Category } from './types';

export type SlashRoute =
  | { kind: 'none' }
  | { kind: 'match'; category: Category; body: string }
  | { kind: 'unknown'; token: string };

/** `Date Ideas` → `date-ideas`: the single-token form typeable after `/`. */
export function categorySlug(name: string): string {
  return name.trim().toLowerCase().split(/[\s-]+/).filter(Boolean).join('-');
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Length of the `/name` prefix of `text` that names `cat`, or 0 if none.
// Words of a multi-word name may be separated by spaces/tabs or hyphens, so
// `/date ideas`, `/Date  Ideas` and `/date-ideas` all reach "Date Ideas".
// The name must end at whitespace or end of input (`/workout` ≠ `/work`).
function prefixLength(text: string, cat: Category): number {
  const words = cat.name.trim().split(/[\s-]+/).filter(Boolean);
  if (words.length === 0) return 0;
  const re = new RegExp(`^/${words.map(escapeRe).join('(?:[ \\t]+|-)')}(?=\\s|$)`, 'i');
  const m = text.match(re);
  return m ? m[0].length : 0;
}

/**
 * Parse a leading `/dir` in capture text.
 *  - `match`: the longest category name (or slug) after `/`; `body` is the
 *    trimmed rest (may be empty — callers hint rather than commit).
 *  - `unknown`: starts with `/word` but names no category; `token` is `word`.
 *  - `none`: not slash-routed.
 */
export function parseSlashRoute(text: string, categories: Category[]): SlashRoute {
  const input = text.trim();
  if (!input.startsWith('/')) return { kind: 'none' };

  let best: { category: Category; len: number } | null = null;
  for (const category of categories) {
    const len = prefixLength(input, category);
    if (len > 0 && (!best || len > best.len)) best = { category, len };
  }
  if (best) return { kind: 'match', category: best.category, body: input.slice(best.len).trim() };

  const token = input.match(/^\/(\S+)/);
  return token ? { kind: 'unknown', token: token[1] } : { kind: 'none' };
}
