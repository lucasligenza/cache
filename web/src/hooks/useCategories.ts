import { useCategoriesCore } from '@cache/core';
import { supabase } from '../lib/supabase';
import { DEFAULT_CATEGORIES, ACCENT_COLORS } from '../constants';

// Categories data layer now lives in @cache/core (shared with native). Web injects
// its Supabase client plus the web default categories + accent palette.
export function useCategories(enabled = true, onError?: (msg: string) => void) {
  return useCategoriesCore({
    supabase,
    seedCategories: DEFAULT_CATEGORIES,
    accentColors: ACCENT_COLORS,
    enabled,
    onError,
  });
}
