import { useEffect, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { supabase } from '../lib/supabase';
import { Note } from '../types';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function requestNotificationPermissions() {
  if (!Device.isDevice) return false;
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function scheduleNoteReminder(note: Note) {
  if (!note.remind_at) return;
  const trigger = new Date(note.remind_at);
  if (trigger <= new Date()) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: '[PING] ~/cache',
      body: note.text.slice(0, 100),
      data: { noteId: note.id, categoryId: note.category_id },
    },
    trigger,
  });
}

export function useReminders(refetchNotes: () => void) {
  const checkReminders = useCallback(async () => {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .lte('remind_at', now)
      .eq('pending_review', false);

    if (error || !data || data.length === 0) return;

    for (const note of data) {
      await supabase
        .from('notes')
        .update({ pending_review: true, remind_at: null })
        .eq('id', note.id);
    }
    refetchNotes();
  }, [refetchNotes]);

  useEffect(() => {
    checkReminders();

    const handleAppState = (nextState: AppStateStatus) => {
      if (nextState === 'active') checkReminders();
    };

    const sub = AppState.addEventListener('change', handleAppState);
    return () => sub.remove();
  }, [checkReminders]);
}
