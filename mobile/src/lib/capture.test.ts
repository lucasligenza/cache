import { describe, it, expect } from 'vitest';
import { resolveCaptureInput, composerBottomInset } from './capture';
import type { Category } from '@cache/core';

const CATS: Category[] = [
  { id: 'c1', name: 'Work', color: '#F5A623', created_at: '2026-01-01T00:00:00Z' },
];

describe('resolveCaptureInput', () => {
  it('rejects empty / whitespace', () => {
    expect(resolveCaptureInput('  ', CATS, null)).toEqual({ ok: false, hint: 'type a note first' });
  });

  it('files a plain note to the buffer by default', () => {
    expect(resolveCaptureInput('buy milk', CATS, null)).toEqual({
      ok: true,
      text: 'buy milk',
      categoryId: undefined,
    });
  });

  it('honors an explicit category chip without treating it as a todo/work launch', () => {
    expect(resolveCaptureInput('buy milk', CATS, 'c1')).toEqual({
      ok: true,
      text: 'buy milk',
      categoryId: 'c1',
    });
  });

  it('routes /dir with a body to that category', () => {
    expect(resolveCaptureInput('/work buy milk', CATS, null)).toEqual({
      ok: true,
      text: 'buy milk',
      categoryId: 'c1',
    });
  });

  it('does not commit a body-less /dir', () => {
    expect(resolveCaptureInput('/work', CATS, null)).toEqual({
      ok: false,
      hint: 'add a note after /work',
    });
  });

  it('files an unknown /dir (e.g. /todo) verbatim to buffer — no workflow launch', () => {
    expect(resolveCaptureInput('/todo buy milk', CATS, 'c1')).toEqual({
      ok: true,
      text: '/todo buy milk',
      categoryId: undefined,
      warning: "no category 'todo' — filed to buffer",
    });
  });
});

describe('composerBottomInset', () => {
  it('uses keyboard height when open and does not add safe-area on top of it', () => {
    expect(composerBottomInset(336, 34, false)).toBe(336);
    expect(composerBottomInset(336, 34, true)).toBe(336);
  });

  it('uses safe-area bottom when the keyboard is closed and the parent does not reserve it', () => {
    expect(composerBottomInset(0, 34, false)).toBe(34);
  });

  it('does not double-count the home indicator when the tab bar already padded it', () => {
    expect(composerBottomInset(0, 34, true)).toBe(0);
  });
});
