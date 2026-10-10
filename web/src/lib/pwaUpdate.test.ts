import { describe, it, expect, vi } from 'vitest';
import { createReloadScheduler, createUpdateChecker, hasUnsentText, MIN_CHECK_GAP_MS } from './pwaUpdate';

function scheduler(opts: { hidden?: boolean; unsent?: boolean } = {}) {
  const state = { hidden: opts.hidden ?? false, unsent: opts.unsent ?? false };
  const target = new EventTarget();
  const reload = vi.fn();
  const s = createReloadScheduler({
    reload,
    isHidden: () => state.hidden,
    hasUnsentText: () => state.unsent,
    target: target as unknown as Document,
  });
  const fire = () => target.dispatchEvent(new Event('visibilitychange'));
  return { s, reload, state, fire };
}

describe('createReloadScheduler', () => {
  it('does nothing until an update asks for a reload', () => {
    const { reload, state, fire } = scheduler();
    state.hidden = true;
    fire();
    expect(reload).not.toHaveBeenCalled();
  });

  it('waits for the app to be backgrounded instead of reloading under the user', () => {
    const { s, reload, state, fire } = scheduler();
    s.request();
    expect(reload).not.toHaveBeenCalled();
    state.hidden = true;
    fire();
    expect(reload).toHaveBeenCalledTimes(1);
    expect(s.isPending()).toBe(false);
  });

  it('reloads straight away when the update lands while already in the background', () => {
    const { s, reload } = scheduler({ hidden: true });
    s.request();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('never reloads while a field still holds unsent text', () => {
    const { s, reload, state, fire } = scheduler({ hidden: true, unsent: true });
    s.request();
    fire();
    expect(reload).not.toHaveBeenCalled();
    state.unsent = false;
    fire();
    expect(reload).toHaveBeenCalledTimes(1);
  });
});

describe('createUpdateChecker', () => {
  it('throttles update checks', () => {
    let t = 1_000_000;
    const update = vi.fn(() => Promise.resolve());
    const check = createUpdateChecker(update, () => t);
    check();
    check();
    expect(update).toHaveBeenCalledTimes(1);
    t += MIN_CHECK_GAP_MS;
    check();
    expect(update).toHaveBeenCalledTimes(2);
  });

  it('swallows a failed update (e.g. offline)', async () => {
    const check = createUpdateChecker(() => Promise.reject(new Error('offline')));
    expect(() => check()).not.toThrow();
    await Promise.resolve();
  });
});

describe('hasUnsentText', () => {
  it('ignores empty and whitespace-only fields', () => {
    const root = document.createElement('div');
    root.innerHTML = '<textarea>   </textarea><input type="text" value="" />';
    expect(hasUnsentText(root)).toBe(false);
  });

  it('detects a draft in a textarea or text input', () => {
    const root = document.createElement('div');
    root.innerHTML = '<textarea></textarea>';
    root.querySelector('textarea')!.value = 'half a thought';
    expect(hasUnsentText(root)).toBe(true);
  });

  it('does not count passwords or checkboxes', () => {
    const root = document.createElement('div');
    root.innerHTML = '<input type="password" value="hunter2" /><input type="checkbox" value="on" />';
    expect(hasUnsentText(root)).toBe(false);
  });
});
