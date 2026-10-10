import { describe, it, expect } from 'vitest';
import { parseSlashRoute, categorySlug } from './slashRoute';
import type { Category } from '../types';

const cat = (id: string, name: string): Category => ({ id, name, color: '#39FF14', created_at: '2026-01-01T00:00:00Z' });

const WORK = cat('c1', 'Work');
const DATE = cat('c2', 'Date');
const DATE_IDEAS = cat('c3', 'Date Ideas');
const CATS = [WORK, DATE, DATE_IDEAS];

describe('categorySlug', () => {
  it('lowercases and hyphenates multi-word names', () => {
    expect(categorySlug('Date Ideas')).toBe('date-ideas');
    expect(categorySlug('  Side   Projects ')).toBe('side-projects');
    expect(categorySlug('to-do')).toBe('to-do');
    expect(categorySlug('Work')).toBe('work');
  });
});

describe('parseSlashRoute', () => {
  it('returns none for text that is not slash-routed', () => {
    expect(parseSlashRoute('buy milk', CATS)).toEqual({ kind: 'none' });
    expect(parseSlashRoute('', CATS)).toEqual({ kind: 'none' });
    expect(parseSlashRoute('/', CATS)).toEqual({ kind: 'none' });
    expect(parseSlashRoute('/ spaced', CATS)).toEqual({ kind: 'none' });
  });

  it('matches a single-word category case-insensitively', () => {
    expect(parseSlashRoute('/work buy milk', CATS)).toEqual({ kind: 'match', category: WORK, body: 'buy milk' });
    expect(parseSlashRoute('/WORK buy milk', CATS)).toEqual({ kind: 'match', category: WORK, body: 'buy milk' });
  });

  it('reaches a multi-word category by its spaced name', () => {
    expect(parseSlashRoute('/date ideas picnic', CATS)).toEqual({ kind: 'match', category: DATE_IDEAS, body: 'picnic' });
    expect(parseSlashRoute('/Date  Ideas picnic', CATS)).toEqual({ kind: 'match', category: DATE_IDEAS, body: 'picnic' });
  });

  it('reaches a multi-word category by its slug', () => {
    expect(parseSlashRoute('/date-ideas picnic', CATS)).toEqual({ kind: 'match', category: DATE_IDEAS, body: 'picnic' });
  });

  it('prefers the longest matching name, falling back to a shorter one', () => {
    expect(parseSlashRoute('/date night out', CATS)).toEqual({ kind: 'match', category: DATE, body: 'night out' });
    expect(parseSlashRoute('/date ideas', CATS)).toEqual({ kind: 'match', category: DATE_IDEAS, body: '' });
    // Order of categories must not matter.
    expect(parseSlashRoute('/date ideas picnic', [DATE_IDEAS, DATE])).toMatchObject({ category: DATE_IDEAS });
  });

  it('requires the name to end at a word boundary', () => {
    expect(parseSlashRoute('/workout legs', CATS)).toEqual({ kind: 'unknown', token: 'workout' });
    expect(parseSlashRoute('/date-ideasx picnic', CATS)).toEqual({ kind: 'unknown', token: 'date-ideasx' });
  });

  it('returns an empty body for a body-less /dir', () => {
    expect(parseSlashRoute('/work', CATS)).toEqual({ kind: 'match', category: WORK, body: '' });
    expect(parseSlashRoute('/work   ', CATS)).toEqual({ kind: 'match', category: WORK, body: '' });
  });

  it('keeps a multi-line body intact', () => {
    expect(parseSlashRoute('/work\nline one\nline two', CATS)).toEqual({
      kind: 'match', category: WORK, body: 'line one\nline two',
    });
  });

  it('does not let a newline join the words of a category name', () => {
    expect(parseSlashRoute('/date\nideas picnic', CATS)).toEqual({ kind: 'match', category: DATE, body: 'ideas picnic' });
  });

  it('reports the first token of an unknown /dir', () => {
    expect(parseSlashRoute('/todo buy milk', CATS)).toEqual({ kind: 'unknown', token: 'todo' });
  });

  it('treats regex metacharacters in names literally', () => {
    const CPP = cat('c9', 'C++');
    expect(parseSlashRoute('/c++ templates', [CPP])).toEqual({ kind: 'match', category: CPP, body: 'templates' });
    expect(parseSlashRoute('/cxx templates', [CPP])).toEqual({ kind: 'unknown', token: 'cxx' });
  });

  it('accepts hyphen/space interchangeably in hyphenated names', () => {
    const TODO = cat('c8', 'to-do');
    expect(parseSlashRoute('/to do call mom', [TODO])).toEqual({ kind: 'match', category: TODO, body: 'call mom' });
    expect(parseSlashRoute('/to-do call mom', [TODO])).toEqual({ kind: 'match', category: TODO, body: 'call mom' });
  });
});
