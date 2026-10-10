import { describe, it, expect } from 'vitest';
import { selectDue, reminderPayload, dueUserIds, groupByUser, isGonePushError, type ReminderRow } from './due';

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

describe('dueUserIds', () => {
  it('dedupes users so subscriptions are fetched in one query', () => {
    const rows = [row({ id: 'a', user_id: 'u1' }), row({ id: 'b', user_id: 'u2' }), row({ id: 'c', user_id: 'u1' })];
    expect(dueUserIds(rows)).toEqual(['u1', 'u2']);
  });
});

describe('groupByUser', () => {
  it('keeps every device of a user', () => {
    const subs = [
      { user_id: 'u1', endpoint: 'https://push/laptop', p256dh_key: 'p', auth_key: 'a' },
      { user_id: 'u2', endpoint: 'https://push/other', p256dh_key: 'p', auth_key: 'a' },
      { user_id: 'u1', endpoint: 'https://push/phone', p256dh_key: 'p', auth_key: 'a' },
    ];
    const byUser = groupByUser(subs);
    expect(byUser.get('u1')?.map(s => s.endpoint)).toEqual(['https://push/laptop', 'https://push/phone']);
    expect(byUser.get('u2')).toHaveLength(1);
    expect(byUser.get('u3')).toBeUndefined();
  });
});

describe('isGonePushError', () => {
  it('treats 404 and 410 from the push service as a dead subscription', () => {
    expect(isGonePushError({ statusCode: 404 })).toBe(true);
    expect(isGonePushError({ statusCode: 410 })).toBe(true);
  });

  it('keeps subscriptions on transient or unknown failures', () => {
    expect(isGonePushError({ statusCode: 429 })).toBe(false);
    expect(isGonePushError({ statusCode: 500 })).toBe(false);
    expect(isGonePushError(new Error('network down'))).toBe(false);
    expect(isGonePushError(null)).toBe(false);
    expect(isGonePushError('410')).toBe(false);
  });
});
