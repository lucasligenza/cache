import { describe, it, expect } from 'vitest';
import { buildReviewSet, countReviewedToday, STALE_CAP } from './review';
import type { Note } from '../types';

const NOW = new Date('2026-07-22T12:00:00Z').getTime();
const daysAgo = (d: number) => new Date(NOW - d * 24 * 60 * 60 * 1000).toISOString();
const hoursAgo = (h: number) => new Date(NOW - h * 60 * 60 * 1000).toISOString();

function note(id: string, over: Partial<Note> = {}): Note {
  return {
    id,
    text: 'n',
    created_at: daysAgo(1),
    updated_at: daysAgo(1),
    category_id: null,
    color: null,
    remind_at: null,
    pending_review: false,
    pinned: false,
    archived_at: null,
    reviewed_at: null,
    ...over,
  };
}

describe('buildReviewSet', () => {
  it('puts an overdue ping in the overdue bucket and counts it', () => {
    const { buckets, count } = buildReviewSet([note('a', { remind_at: hoursAgo(2) })], NOW);
    expect(buckets.find(b => b.key === 'overdue')?.notes.map(n => n.id)).toEqual(['a']);
    expect(count).toBe(1);
  });

  it('ignores a future ping', () => {
    const { buckets, count } = buildReviewSet(
      [note('a', { remind_at: new Date(NOW + 60 * 60 * 1000).toISOString() })],
      NOW
    );
    expect(buckets).toHaveLength(0);
    expect(count).toBe(0);
  });

  it('surfaces a manually flagged note', () => {
    const { buckets, count } = buildReviewSet([note('a', { pending_review: true, category_id: 'c1' })], NOW);
    expect(buckets.find(b => b.key === 'flagged')?.notes.map(n => n.id)).toEqual(['a']);
    expect(count).toBe(1);
  });

  it('surfaces a stale (>3d) unsorted note', () => {
    const { buckets, count } = buildReviewSet([note('a', { created_at: daysAgo(5), updated_at: daysAgo(5) })], NOW);
    expect(buckets.find(b => b.key === 'stale')?.notes.map(n => n.id)).toEqual(['a']);
    expect(count).toBe(1);
  });

  it('suppresses a stale note reviewed within the suppress window', () => {
    const { buckets } = buildReviewSet(
      [note('a', { created_at: daysAgo(10), updated_at: daysAgo(10), reviewed_at: daysAgo(2) })],
      NOW
    );
    expect(buckets).toHaveLength(0);
  });

  it('gives overdue precedence over stale (no duplicate, counted once)', () => {
    const { buckets, count } = buildReviewSet(
      [note('a', { remind_at: hoursAgo(1), created_at: daysAgo(6) })],
      NOW
    );
    expect(buckets.map(b => b.key)).toEqual(['overdue']);
    expect(count).toBe(1);
  });

  it('resurfaces old untouched notes and counts them in the badge (no more silent 0)', () => {
    const { buckets, count } = buildReviewSet(
      [note('a', { category_id: 'c1', created_at: daysAgo(40), updated_at: daysAgo(30) })],
      NOW
    );
    expect(buckets.map(b => b.key)).toEqual(['resurfaced']);
    expect(count).toBe(1);
  });

  it('exposes an actionable subset (overdue+flagged+stale) distinct from the resurfaced total', () => {
    const { count, actionable } = buildReviewSet(
      [
        note('urgent', { remind_at: hoursAgo(1) }),
        note('old', { category_id: 'c1', created_at: daysAgo(40), updated_at: daysAgo(30) }),
      ],
      NOW
    );
    expect(count).toBe(2);      // badge reflects everything in review
    expect(actionable).toBe(1); // only the overdue note "needs attention"
  });

  it('caps the stale bucket', () => {
    const notes = Array.from({ length: STALE_CAP + 3 }, (_, i) =>
      note('s' + i, { created_at: daysAgo(5 + i), updated_at: daysAgo(5 + i) })
    );
    const { buckets } = buildReviewSet(notes, NOW);
    expect(buckets.find(b => b.key === 'stale')?.notes).toHaveLength(STALE_CAP);
  });
});

describe('countReviewedToday', () => {
  it('counts only notes reviewed today', () => {
    const notes = [
      note('a', { reviewed_at: new Date(NOW).toISOString() }),
      note('b', { reviewed_at: daysAgo(3) }),
      note('c'),
    ];
    expect(countReviewedToday(notes, NOW)).toBe(1);
  });
});
