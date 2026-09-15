import { renderHook, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { KEYBOARD_THRESHOLD_PX, useVisualViewport } from './useVisualViewport';

type Listener = EventListenerOrEventListenerObject;

interface MockViewport {
  height: number;
  offsetTop: number;
  addEventListener: (type: string, fn: Listener) => void;
  removeEventListener: (type: string, fn: Listener) => void;
  dispatch: (type: string) => void;
}

function mockVisualViewport(init: { height: number; offsetTop?: number }): MockViewport {
  const listeners = new Map<string, Set<Listener>>();
  const vv: MockViewport = {
    height: init.height,
    offsetTop: init.offsetTop ?? 0,
    addEventListener: (type, fn) => {
      const set = listeners.get(type) ?? new Set();
      set.add(fn);
      listeners.set(type, set);
    },
    removeEventListener: (type, fn) => {
      listeners.get(type)?.delete(fn);
    },
    dispatch: type => {
      listeners.get(type)?.forEach(fn => {
        if (typeof fn === 'function') fn(new Event(type));
        else fn.handleEvent(new Event(type));
      });
    },
  };
  Object.defineProperty(window, 'visualViewport', { configurable: true, value: vv });
  return vv;
}

describe('useVisualViewport', () => {
  const innerHeight = 844;

  beforeEach(() => {
    vi.stubGlobal('innerHeight', innerHeight);
    document.documentElement.removeAttribute('data-keyboard');
    document.documentElement.style.removeProperty('--vv-height');
    document.documentElement.style.removeProperty('--vv-offset-top');
  });

  afterEach(() => {
    document.documentElement.removeAttribute('data-keyboard');
    document.documentElement.style.removeProperty('--vv-height');
    document.documentElement.style.removeProperty('--vv-offset-top');
    vi.unstubAllGlobals();
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: undefined });
  });

  it('writes visualViewport height and offset to html CSS variables', () => {
    mockVisualViewport({ height: 844, offsetTop: 0 });
    renderHook(() => useVisualViewport());
    expect(document.documentElement.style.getPropertyValue('--vv-height')).toBe('844px');
    expect(document.documentElement.style.getPropertyValue('--vv-offset-top')).toBe('0px');
    expect(document.documentElement.getAttribute('data-keyboard')).toBeNull();
  });

  it('ignores small visualViewport shrinks (browser chrome / URL bar)', () => {
    const vv = mockVisualViewport({ height: 844 });
    renderHook(() => useVisualViewport());
    vv.height = 844 - 80;
    act(() => vv.dispatch('resize'));
    expect(document.documentElement.getAttribute('data-keyboard')).toBeNull();
    expect(document.documentElement.style.getPropertyValue('--vv-height')).toBe('764px');
  });

  it('marks data-keyboard=open when the visual viewport shrinks past the keyboard threshold', () => {
    const vv = mockVisualViewport({ height: 844 });
    renderHook(() => useVisualViewport());
    vv.height = 500;
    act(() => vv.dispatch('resize'));
    expect(document.documentElement.getAttribute('data-keyboard')).toBe('open');
    expect(document.documentElement.style.getPropertyValue('--vv-height')).toBe('500px');
  });

  it('keeps the keyboard-open flag while the viewport stays short (save tap / blur)', () => {
    const vv = mockVisualViewport({ height: 844 });
    renderHook(() => useVisualViewport());
    vv.height = 500;
    act(() => vv.dispatch('resize'));
    expect(document.documentElement.getAttribute('data-keyboard')).toBe('open');
    // Blur does not restore height — iOS often dismisses the field first.
    act(() => vv.dispatch('resize'));
    expect(document.documentElement.getAttribute('data-keyboard')).toBe('open');
    expect(document.documentElement.style.getPropertyValue('--vv-height')).toBe('500px');
  });

  it('marks the keyboard open when iOS pans the visual viewport (offsetTop)', () => {
    const vv = mockVisualViewport({ height: 844, offsetTop: 0 });
    renderHook(() => useVisualViewport());
    vv.offsetTop = KEYBOARD_THRESHOLD_PX + 30;
    act(() => vv.dispatch('scroll'));
    expect(document.documentElement.getAttribute('data-keyboard')).toBe('open');
    expect(document.documentElement.style.getPropertyValue('--vv-offset-top')).toBe(
      `${KEYBOARD_THRESHOLD_PX + 30}px`
    );
  });

  it('clears data-keyboard when the visual viewport returns to idle height', () => {
    const vv = mockVisualViewport({ height: 844 });
    renderHook(() => useVisualViewport());
    vv.height = 480;
    act(() => vv.dispatch('resize'));
    expect(document.documentElement.getAttribute('data-keyboard')).toBe('open');
    vv.height = 844;
    act(() => vv.dispatch('resize'));
    expect(document.documentElement.getAttribute('data-keyboard')).toBeNull();
  });

  it('falls back to window.innerHeight when visualViewport is missing', () => {
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: null });
    renderHook(() => useVisualViewport());
    expect(document.documentElement.style.getPropertyValue('--vv-height')).toBe(`${innerHeight}px`);
    expect(document.documentElement.style.getPropertyValue('--vv-offset-top')).toBe('0px');
  });

  it('removes CSS variables and data-keyboard on unmount', () => {
    mockVisualViewport({ height: 800 });
    const { unmount } = renderHook(() => useVisualViewport());
    unmount();
    expect(document.documentElement.style.getPropertyValue('--vv-height')).toBe('');
    expect(document.documentElement.getAttribute('data-keyboard')).toBeNull();
  });
});
