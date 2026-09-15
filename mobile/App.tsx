import React, { useState, useRef, useCallback, useEffect } from 'react';
import { View, StyleSheet, Keyboard } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import PagerView from 'react-native-pager-view';
import {
  useFonts,
  JetBrainsMono_400Regular,
  JetBrainsMono_700Bold,
} from '@expo-google-fonts/jetbrains-mono';
import * as SplashScreen from 'expo-splash-screen';
import { setOutboxStorage } from '@cache/core';

import { BootSequence } from './src/components/BootSequence';
import { DataLoadingScreen } from './src/components/DataLoadingScreen';
import { PageIndicator } from './src/components/PageIndicator';
import { CaptureScreen } from './src/screens/CaptureScreen';
import { BufferScreen } from './src/screens/BufferScreen';
import { BoardScreen } from './src/screens/BoardScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { ConfigErrorScreen } from './src/screens/ConfigErrorScreen';
import { useNotes } from './src/hooks/useNotes';
import { useCategories } from './src/hooks/useCategories';
import { useAuth } from './src/hooks/useAuth';
import { useKeyboardHeight } from './src/hooks/useKeyboardHeight';
import { useReminders } from './src/hooks/useReminders';
import { COLORS } from './src/constants';
import { isSupabaseConfigured } from './src/lib/config';
import { createNativeOutboxStorage } from './src/lib/outboxStorage';
import { initOnlineSignal } from './src/lib/online';
import { composerBottomInset } from './src/lib/capture';

SplashScreen.preventAutoHideAsync();

setOutboxStorage(createNativeOutboxStorage());
initOnlineSignal();

function Shell() {
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();
  const keyboardOpen = keyboardHeight > 0;

  const [booting, setBooting] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [captureCategory, setCaptureCategory] = useState<string | null>(null);
  const pagerRef = useRef<PagerView>(null);

  const { user, loading: authLoading, signIn, signUp, signInAsGuest } = useAuth();

  const {
    notes,
    unsortedNotes,
    loading: notesLoading,
    createNote,
    updateNote,
    archiveNote,
    deleteNote,
    getNotesByCategory,
    refetch: refetchNotes,
  } = useNotes(!!user && !booting, undefined, user?.id ?? null);

  const {
    categories,
    loading: catsLoading,
    createCategory,
    updateCategory,
    deleteCategory,
  } = useCategories(!!user && !booting);

  useReminders(refetchNotes);

  const handleBootDone = useCallback(() => setBooting(false), []);

  const handleCommit = useCallback(async (text: string, categoryId?: string) => {
    // Inbox only: core createNote writes text + optional category. It does not
    // set pending_review, remind_at, or navigate into a workflow.
    await createNote(text, categoryId);
    setCaptureCategory(null);
  }, [createNote]);

  const handleAssign = useCallback(async (noteId: string, categoryId: string) => {
    await updateNote(noteId, { category_id: categoryId });
  }, [updateNote]);

  const navigateToPage = useCallback((page: number) => {
    Keyboard.dismiss();
    pagerRef.current?.setPage(page);
  }, []);

  const navigateToCapture = useCallback((categoryId?: string) => {
    setCaptureCategory(categoryId ?? null);
    pagerRef.current?.setPage(1);
  }, []);

  const onPageSelected = useCallback((position: number) => {
    setCurrentPage(position);
    if (position !== 1) Keyboard.dismiss();
  }, []);

  if (booting) {
    return <BootSequence onDone={handleBootDone} />;
  }

  if (authLoading) {
    return <DataLoadingScreen />;
  }

  if (!user) {
    return (
      <LoginScreen
        onSignIn={signIn}
        onSignUp={signUp}
        onGuest={signInAsGuest}
      />
    );
  }

  if (notesLoading || catsLoading) {
    return <DataLoadingScreen />;
  }

  // When the pager dots are visible they already sit on the home indicator, so
  // the pager itself should not add safe-area bottom. When the keyboard is
  // open the dots hide and the composer docks above the keyboard.
  const bottomPad = composerBottomInset(keyboardHeight, insets.bottom, !keyboardOpen);

  return (
    <View style={styles.root}>
      <View style={[styles.body, { paddingTop: insets.top, paddingBottom: bottomPad }]}>
        <PagerView
          ref={pagerRef}
          style={styles.pager}
          initialPage={1}
          onPageSelected={e => onPageSelected(e.nativeEvent.position)}
        >
          <View key="0" style={styles.page} collapsable={false}>
            <BufferScreen
              notes={notes}
              categories={categories}
              onAssign={handleAssign}
              onDelete={deleteNote}
            />
          </View>

          <View key="1" style={styles.page} collapsable={false}>
            <CaptureScreen
              onCommit={handleCommit}
              categories={categories}
              initialCategoryId={captureCategory}
              bufferCount={unsortedNotes.length}
              keyboardOpen={keyboardOpen}
            />
          </View>

          <View key="2" style={styles.page} collapsable={false}>
            <BoardScreen
              categories={categories}
              notes={notes}
              onUpdateNote={updateNote}
              onArchiveNote={archiveNote}
              onCreateNote={createNote}
              onCreateCategory={createCategory}
              onRenameCategory={(id, name) => updateCategory(id, { name })}
              onDeleteCategory={deleteCategory}
              getNotesByCategory={getNotesByCategory}
              onNavigateToCapture={navigateToCapture}
            />
          </View>
        </PagerView>
      </View>

      {!keyboardOpen && (
        <View style={{ paddingBottom: insets.bottom }}>
          <PageIndicator
            currentPage={currentPage}
            onPress={navigateToPage}
            unsortedCount={unsortedNotes.length}
          />
        </View>
      )}
    </View>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    JetBrainsMono_400Regular,
    JetBrainsMono_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  if (!isSupabaseConfigured()) {
    return (
      <SafeAreaProvider>
        <ConfigErrorScreen />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Shell />
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  body: {
    flex: 1,
  },
  pager: {
    flex: 1,
  },
  page: {
    flex: 1,
  },
});
