import type { Note, Category } from './types';

// Pure export builders — no DOM, so they are shared with native (which does its
// own file/share handling). The web download wrapper stays in the web package.

export function buildJson(notes: Note[], categories: Category[], nowIso: string): string {
  return JSON.stringify({ exported_at: nowIso, version: 1, categories, notes }, null, 2);
}

export function buildMarkdown(notes: Note[], categories: Category[], nowIso: string): string {
  const nameById = new Map(categories.map(c => [c.id, c.name]));
  const lines: string[] = ['# CacheNotes export', '', `_exported ${nowIso}_`, ''];

  const UNSORTED = '__unsorted__';
  const groups = new Map<string, Note[]>();
  for (const n of notes) {
    const key = n.category_id ?? UNSORTED;
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(n);
  }

  const order = [...categories.map(c => c.id), UNSORTED];
  for (const key of order) {
    const group = groups.get(key);
    if (!group || group.length === 0) continue;
    const title = key === UNSORTED ? 'buffer (unsorted)' : `/${(nameById.get(key) ?? key).toLowerCase()}`;
    lines.push(`## ${title}`, '');
    for (const n of group) lines.push(`- ${n.text.replace(/\r?\n/g, ' ')}`);
    lines.push('');
  }
  return lines.join('\n');
}
