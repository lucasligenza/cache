import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Category } from '../types';
import { DEFAULT_CATEGORIES, ACCENT_COLORS } from '../constants';

export function useCategories(enabled = true) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) { console.error(error); return; }

    if (data && data.length === 0) {
      // Seed defaults
      const { data: seeded } = await supabase
        .from('categories')
        .insert(DEFAULT_CATEGORIES)
        .select();
      setCategories(seeded || []);
    } else {
      setCategories(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { if (enabled) fetch(); }, [fetch, enabled]);

  const createCategory = useCallback(async (name: string) => {
    const usedColors = categories.map(c => c.color);
    const color = ACCENT_COLORS.find(c => !usedColors.includes(c)) || ACCENT_COLORS[categories.length % ACCENT_COLORS.length];

    const optimistic: Category = {
      id: `temp-${Date.now()}`,
      name,
      color,
      created_at: new Date().toISOString(),
    };
    setCategories(prev => [...prev, optimistic]);

    const { data, error } = await supabase
      .from('categories')
      .insert({ name, color })
      .select()
      .single();

    if (error) {
      setCategories(prev => prev.filter(c => c.id !== optimistic.id));
      throw error;
    }
    setCategories(prev => prev.map(c => c.id === optimistic.id ? data : c));
    return data;
  }, [categories]);

  const updateCategory = useCallback(async (id: string, updates: Partial<Category>) => {
    setCategories(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
    const { error } = await supabase.from('categories').update(updates).eq('id', id);
    if (error) { fetch(); throw error; }
  }, [fetch]);

  const deleteCategory = useCallback(async (id: string) => {
    setCategories(prev => prev.filter(c => c.id !== id));
    const { error } = await supabase.from('categories').delete().eq('id', id);
    if (error) { fetch(); throw error; }
  }, [fetch]);

  return { categories, loading, createCategory, updateCategory, deleteCategory, refetch: fetch };
}
