import { describe, it, expect } from 'vitest';
import { selectDue, reminderPayload, type ReminderRow } from './due';

function row(overrides: Partial<ReminderRow> = {}): ReminderRow {
  return {
    id: 'n1',
    text: 'ping me',
    user_id: 'u1',
    remind_at: '2026-01-01T00:00:00.000Z',
    reminded_at: null,
    ...overrides,
  };
}

const NOW = '2026-01-02T00:00:00.000Z';

describe('selectDue', () => {
  it('includes a past-due reminder that has never been sent', () => {
    expect(selectDue([row()], NOW).map(n => n.id)).toEqual(['n1']);
  });

  it('excludes a reminder not yet due (remind_at in the future)', () => {
    expect(selectDue([row({ remind_at: '2026-02-01T00:00:00.000Z' })], NOW)).toEqual([]);
  });

  it('excludes a reminder already sent for this remind_at (deduped)', () => {
    // reminded_at at/after remind_at → already handled.
    expect(selectDue([row({ reminded_at: '2026-01-01T00:05:00.000Z' })], NOW)).toEqual([]);
  });

  it('re-arms when rescheduled to a newer remind_at (reminded_at now stale)', () => {
    // remind_at moved forward past the old reminded_at, but still <= now.
    const r = row({ remind_at: '2026-01-01T12:00:00.000Z', reminded_at: '2026-01-01T00:00:00.000Z' });
    expect(selectDue([r], NOW).map(n => n.id)).toEqual(['n1']);
  });

  it('returns nothing for an empty set', () => {
    expect(selectDue([], NOW)).toEqual([]);
  });

  it('filters a mixed batch down to the genuinely due', () => {
    const rows = [
      row({ id: 'due-fresh' }),
      row({ id: 'future', remind_at: '2027-01-01T00:00:00.000Z' }),
      row({ id: 'already', reminded_at: '2026-01-01T01:00:00.000Z' }),
      row({ id: 'rearmed', remind_at: '2026-01-01T18:00:00.000Z', reminded_at: '2026-01-01T00:00:00.000Z' }),
    ];
    expect(selectDue(rows, NOW).map(n => n.id).sort()).toEqual(['due-fresh', 'rearmed']);
  });
});

describe('reminderPayload', () => {
  it('carries the fixed title and the note text as the body', () => {
    expect(JSON.parse(reminderPayload(row({ text: 'call mom' })))).toEqual({
      title: 'cache reminder',
      body: 'call mom',
    });
  });

  it('truncates the body to 100 characters', () => {
    const long = 'x'.repeat(250);
    const { body } = JSON.parse(reminderPayload(row({ text: long })));
    expect(body).toHaveLength(100);
  });
});
