import { describe, it, expect } from 'vitest';
import { buildJson, buildMarkdown } from './exporter';
import type { Note, Category } from '../types';

const NOW = '2026-07-22T12:00:00.000Z';

const cats: Category[] = [
  { id: 'c1', name: 'Work', color: '#F5A623', created_at: NOW },
];

function note(over: Partial<Note>): Note {
  return {
    id: 'x', text: 't', created_at: NOW, updated_at: NOW, category_id: null,
    color: null, remind_at: null, pending_review: false, pinned: false,
    archived_at: null, reviewed_at: null, ...over,
  };
}

describe('buildJson', () => {
  it('produces parseable JSON with notes + categories', () => {
    const parsed = JSON.parse(buildJson([note({ id: 'n1', text: 'hello' })], cats, NOW));
    expect(parsed.exported_at).toBe(NOW);
    expect(parsed.notes).toHaveLength(1);
    expect(parsed.categories).toHaveLength(1);
    expect(parsed.notes[0].text).toBe('hello');
  });
});

describe('buildMarkdown', () => {
  it('groups notes by category with unsorted last', () => {
    const notes = [
      note({ id: 'n1', text: 'work task', category_id: 'c1' }),
      note({ id: 'n2', text: 'loose thought' }),
    ];
    const md = buildMarkdown(notes, cats, NOW);
    expect(md).toContain('## /work');
    expect(md).toContain('- work task');
    expect(md).toContain('## buffer (unsorted)');
    expect(md).toContain('- loose thought');
    expect(md.indexOf('## /work')).toBeLessThan(md.indexOf('## buffer'));
  });

  it('flattens newlines in note text', () => {
    const md = buildMarkdown([note({ text: 'line1\nline2' })], cats, NOW);
    expect(md).toContain('- line1 line2');
  });
});
