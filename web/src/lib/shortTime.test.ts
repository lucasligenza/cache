import { describe, it, expect } from 'vitest';
import { shortTime } from './shortTime';

const NOW = Date.parse('2026-10-10T12:00:00Z');
const at = (offsetMs: number) => new Date(NOW + offsetMs).toISOString();
const M = 60_000, H = 60 * M, D = 24 * H;

describe('shortTime', () => {
  it.each([
    [0, 'now'],
    [-30_000, 'now'],
    [-20 * M, '20m ago'],
    [-5 * H, '5h ago'],
    [-26 * H, '1d ago'],
    [-45 * D, '1mo ago'],
    [-800 * D, '2y ago'],
    [3 * H, 'in 3h'],
    [90 * M, 'in 1h'],
    [2 * D + H, 'in 2d'],
  ])('%i ms → %s', (offset, expected) => {
    expect(shortTime(at(offset), NOW)).toBe(expected);
  });
});
