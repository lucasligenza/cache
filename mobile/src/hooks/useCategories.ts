import { useCategoriesCore } from '@cache/core';
import { supabase } from '../lib/supabase';
import { DEFAULT_CATEGORIES, ACCENT_COLORS } from '../constants';

export function useCategories(enabled = true, onError?: (msg: string) => void) {
  return useCategoriesCore({
    supabase,
    seedCategories: DEFAULT_CATEGORIES,
    accentColors: ACCENT_COLORS,
    enabled,
    onError,
  });
}
