import { useState, useEffect, useCallback, useRef } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Category } from './types';

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
  onError?: (msg: string) => void;
}

export function useCategoriesCore(deps: CategoriesDeps) {
  const enabled = deps.enabled ?? true;
  const depsRef = useRef(deps);
  depsRef.current = deps;
  const db = () => depsRef.current.supabase;
  const fail = (msg: string) => depsRef.current.onError?.(msg);

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const fetch = useCallback(async () => {
    const { data, error } = await db()
      .from('categories')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) { setLoadError(true); fail('failed to load categories'); setLoading(false); return; }
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
