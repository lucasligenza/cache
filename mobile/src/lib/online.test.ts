import { describe, it, expect } from 'vitest';
import { readIsOnline } from './onlineState';

describe('readIsOnline', () => {
  it('is online when connected and reachability is unknown', () => {
    expect(readIsOnline({ isConnected: true, isInternetReachable: null })).toBe(true);
  });

  it('is offline when the OS reports disconnected', () => {
    expect(readIsOnline({ isConnected: false, isInternetReachable: null })).toBe(false);
  });

  it('is offline when connected but internet is unreachable', () => {
    expect(readIsOnline({ isConnected: true, isInternetReachable: false })).toBe(false);
  });
});
