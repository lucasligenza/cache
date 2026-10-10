import { useState, useEffect, useCallback, useRef } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Category } from './types';
import { FOREGROUND_REFETCH_MIN_MS, type SubscribeForeground } from './sync';

/**
 * Platform deps for categories. The seed set (used when a user has none) and the
 * accent palette (for auto-coloring new categories) are injected so each app can
 * choose its own defaults.
 */
export interface CategoriesDeps {
  supabase: SupabaseClient;
  seedCategories: { name: string; color: string }[];
  accentColors: string[];
  enabled?: boolean;
  /** User-facing failure messages. Load failures are not sent here — read `error` instead. */
  onError?: (msg: string) => void;
  /** Every failed request, for telemetry. */
  onRequestError?: (op: string, error: unknown) => void;
  /** Foreground / back-online signal; triggers a quiet refetch (see useNotesCore). */
  subscribeForeground?: SubscribeForeground;
  isOnline?: () => boolean;
}

export function useCategoriesCore(deps: CategoriesDeps) {
  const enabled = deps.enabled ?? true;
  const depsRef = useRef(deps);
  depsRef.current = deps;
  const db = () => depsRef.current.supabase;
  const report = (op: string, error: unknown) => {
    try { depsRef.current.onRequestError?.(op, error); } catch { /* never break the app */ }
  };

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const lastFetchAt = useRef(0);

  const fetch = useCallback(async () => {
    const { data, error } = await db()
      .from('categories')
      .select('*')
      .order('created_at', { ascending: true });
    lastFetchAt.current = Date.now();
    // No toast: the app shell shows an offline/retry banner off `error`.
    if (error) { report('load-categories', error); setLoadError(true); setLoading(false); return; }
    setLoadError(false);
    if (data && data.length === 0) {
      const { data: seeded } = await db()
        .from('categories')
        .insert(depsRef.current.seedCategories)
        .select();
      setCategories((seeded as Category[]) || []);
    } else {
      setCategories((data as Category[]) || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { if (enabled) fetch(); }, [fetch, enabled]);

  useEffect(() => {
    const subscribe = depsRef.current.subscribeForeground;
    if (!enabled || !subscribe) return;
    return subscribe(reason => {
      if (!(depsRef.current.isOnline?.() ?? true)) return;
      if (reason === 'online' || Date.now() - lastFetchAt.current >= FOREGROUND_REFETCH_MIN_MS) void fetch();
    });
  }, [enabled, fetch]);

  const createCategory = useCallback(async (name: string) => {
    const accents = depsRef.current.accentColors;
    const usedColors = categories.map(c => c.color);
    const color = accents.find(c => !usedColors.includes(c))
      ?? accents[categories.length % accents.length];
    const optimistic: Category = { id: `temp-${Date.now()}`, name, color, created_at: new Date().toISOString() };
    setCategories(prev => [...prev, optimistic]);
    const { data, error } = await db()
      .from('categories')
      .insert({ name, color })
      .select()
      .single();
    if (error) {
      setCategories(prev => prev.filter(c => c.id !== optimistic.id));
      throw error;
    }
    setCategories(prev => prev.map(c => c.id === optimistic.id ? (data as Category) : c));
    return data as Category;
  }, [categories]);

  const updateCategory = useCallback(async (id: string, updates: Partial<Category>) => {
    setCategories(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
    const { error } = await db().from('categories').update(updates).eq('id', id);
    if (error) { fetch(); throw error; }
  }, [fetch]);

  const deleteCategory = useCallback(async (id: string) => {
    setCategories(prev => prev.filter(c => c.id !== id));
    const { error } = await db().from('categories').delete().eq('id', id);
    if (error) { fetch(); throw error; }
  }, [fetch]);

  return { categories, loading, error: loadError, createCategory, updateCategory, deleteCategory, refetch: fetch };
}
