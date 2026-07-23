// Data types now live in @cache/core (shared with the native app). Re-exported
// here so existing `./types` / `../types` imports keep working. ViewName is a
// web-only UI concern and stays here.
export type { Note, Category } from '@cache/core';

export type ViewName = 'buffer' | 'board' | 'search' | 'settings' | 'archive' | 'review';
