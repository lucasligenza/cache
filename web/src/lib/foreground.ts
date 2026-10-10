import type { SubscribeForeground } from '@cache/core';

// Browser foreground signal for the core data hooks: the tab became visible, an
// installed PWA resumed (iOS restores it from the back/forward cache), or the
// network came back.
export const subscribeForeground: SubscribeForeground = cb => {
  const onVisible = () => { if (document.visibilityState === 'visible') cb('foreground'); };
  const onPageShow = (e: PageTransitionEvent) => { if (e.persisted) cb('foreground'); };
  const onOnline = () => cb('online');
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('pageshow', onPageShow);
  window.addEventListener('online', onOnline);
  return () => {
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('pageshow', onPageShow);
    window.removeEventListener('online', onOnline);
  };
};
