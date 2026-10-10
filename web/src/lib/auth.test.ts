import { describe, it, expect, beforeEach } from 'vitest';
import {
  friendlyAuthError,
  parseAuthRedirect,
  recoveryRedirectUrl,
  stripAuthRedirect,
  guestNudgeDue,
  clearOutboxFor,
  addToOutbox,
  readOutbox,
  setOutboxScope,
  OUTBOX_KEY,
} from '@cache/core';

describe('friendlyAuthError', () => {
  it.each([
    ['Invalid login credentials', 'wrong email or password'],
    ['Anonymous sign-ins are disabled', 'guest mode unavailable — sign up instead'],
    ['User already registered', 'that email already has an account'],
    ['A user with this email address has already been registered', 'that email already has an account'],
    ['Email not confirmed', 'email not confirmed — open the link we emailed you, then sign in'],
    ['Password should be at least 6 characters.', 'password too weak — use 8+ characters'],
    ['New password should be different from the old password.', 'new password must differ from the old one'],
    ['Email link is invalid or has expired', 'that link has expired — request a new one'],
    ['email rate limit exceeded', 'too many attempts — wait a minute and try again'],
    ['Failed to fetch', "can't reach the server — check your connection"],
  ])('%s → %s', (raw, friendly) => {
    expect(friendlyAuthError(raw)).toBe(friendlyAuthError(raw.toUpperCase()));
    expect(friendlyAuthError(raw)).toBe(friendly);
  });

  it('lowercases unknown messages and drops the trailing period', () => {
    expect(friendlyAuthError('Something Odd happened.')).toBe('something odd happened');
  });

  it('has a fallback for empty messages', () => {
    expect(friendlyAuthError(undefined)).toMatch(/try again/);
  });
});

describe('auth redirect parsing', () => {
  it('builds a reset redirect carrying the recovery marker', () => {
    expect(recoveryRedirectUrl('https://cache.app/')).toBe('https://cache.app/?auth=recovery');
  });

  it('detects a recovery landing from the token hash', () => {
    expect(parseAuthRedirect('https://cache.app/#access_token=x&type=recovery')).toEqual({ type: 'recovery', error: null });
  });

  it('detects a recovery landing from the marker alone (hash already consumed)', () => {
    expect(parseAuthRedirect('https://cache.app/?auth=recovery')).toEqual({ type: 'recovery', error: null });
  });

  it('turns an expired link into friendly copy', () => {
    const r = parseAuthRedirect(
      'https://cache.app/?auth=recovery#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired'
    );
    expect(r).toEqual({ type: 'recovery', error: 'that link has expired — request a new one' });
  });

  it('ignores ordinary URLs', () => {
    expect(parseAuthRedirect('https://cache.app/')).toEqual({ type: null, error: null });
    expect(parseAuthRedirect('not a url')).toEqual({ type: null, error: null });
  });

  it('strips the marker and error params but keeps everything else', () => {
    expect(stripAuthRedirect('https://cache.app/?auth=recovery&x=1')).toBe('https://cache.app/?x=1');
    expect(
      stripAuthRedirect('https://cache.app/#error=access_denied&error_code=otp_expired&error_description=gone')
    ).toBe('https://cache.app/');
    expect(stripAuthRedirect('https://cache.app/?x=1')).toBeNull();
  });
});

describe('guestNudgeDue', () => {
  it('waits until the first threshold', () => {
    expect(guestNudgeDue(9, 0)).toBeNull();
    expect(guestNudgeDue(10, 0)).toBe(10);
  });

  it('nudges once per threshold', () => {
    expect(guestNudgeDue(11, 10)).toBeNull();
    expect(guestNudgeDue(25, 10)).toBe(25);
  });

  it('collapses several crossed thresholds into one nudge', () => {
    expect(guestNudgeDue(60, 0)).toBe(50);
  });
});

describe('clearOutboxFor', () => {
  beforeEach(() => {
    localStorage.clear();
    setOutboxScope(null);
  });

  it("drops only that user's queue", () => {
    const item = { id: 'n1', text: 't', category_id: null, created_at: '2026-01-01T00:00:00Z', attempts: 0 };
    setOutboxScope('guest-1');
    addToOutbox(item);
    setOutboxScope('other');
    addToOutbox({ ...item, id: 'n2' });

    clearOutboxFor('guest-1');

    expect(localStorage.getItem(`${OUTBOX_KEY}:guest-1`)).toBeNull();
    expect(readOutbox().map(i => i.id)).toEqual(['n2']);
  });
});
