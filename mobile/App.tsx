import React, { useState, useRef, useCallback } from 'react';
import { View, StyleSheet, SafeAreaView } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import PagerView from 'react-native-pager-view';
import {
  useFonts,
  JetBrainsMono_400Regular,
  JetBrainsMono_700Bold,
} from '@expo-google-fonts/jetbrains-mono';
import * as SplashScreen from 'expo-splash-screen';

import { BootSequence } from './src/components/BootSequence';
import { DataLoadingScreen } from './src/components/DataLoadingScreen';
import { PageIndicator } from './src/components/PageIndicator';
import { CaptureScreen } from './src/screens/CaptureScreen';
import { BufferScreen } from './src/screens/BufferScreen';
import { BoardScreen } from './src/screens/BoardScreen';
import { useNotes } from './src/hooks/useNotes';
import { useCategories } from './src/hooks/useCategories';
import { useReminders, requestNotificationPermissions } from './src/hooks/useReminders';
import { COLORS } from './src/constants';

SplashScreen.preventAutoHideAsync();

export default function App() {
  const [fontsLoaded] = useFonts({
    JetBrainsMono_400Regular,
    JetBrainsMono_700Bold,
  });
  const [booting, setBooting] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [captureCategory, setCaptureCategory] = useState<string | null>(null);
  const pagerRef = useRef<PagerView>(null);

  const {
    notes, unsortedNotes, loading: notesLoading, createNote, updateNote, archiveNote, deleteNote, getNotesByCategory, refetch: refetchNotes,
  } = useNotes(!booting);

  const {
    categories, loading: catsLoading, createCategory, updateCategory, deleteCategory,
  } = useCategories(!booting);

  useReminders(refetchNotes);

  React.useEffect(() => {
    requestNotificationPermissions();
  }, []);

  React.useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  const onLayout = useCallback(() => {}, []);

  if (!fontsLoaded) return null;

  const handleBootDone = () => setBooting(false);

  const handleCommit = async (text: string, categoryId?: string) => {
    await createNote(text, categoryId);
    setCaptureCategory(null);
  };

  const handleAssign = async (noteId: string, categoryId: string) => {
    await updateNote(noteId, { category_id: categoryId });
  };

  const navigateToPage = (page: number) => {
    pagerRef.current?.setPage(page);
  };

  const navigateToCapture = (categoryId?: string) => {
    setCaptureCategory(categoryId ?? null);
    pagerRef.current?.setPage(1);
  };

  if (booting) {
    return <BootSequence onDone={handleBootDone} />;
  }

  if (notesLoading || catsLoading) {
    return <DataLoadingScreen />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <SafeAreaView style={styles.root} onLayout={onLayout}>
      <PagerView
        ref={pagerRef}
        style={styles.pager}
        initialPage={1}
        onPageSelected={e => setCurrentPage(e.nativeEvent.position)}
      >
        {/* Page 0 — Buffer */}
        <View key="0" style={styles.page}>
          <BufferScreen
            notes={notes}
            categories={categories}
            onAssign={handleAssign}
            onDelete={deleteNote}
          />
        </View>

        {/* Page 1 — Capture */}
        <View key="1" style={styles.page}>
          <CaptureScreen
            onCommit={handleCommit}
            categories={categories}
            initialCategoryId={captureCategory}
          />
        </View>

        {/* Page 2 — Board */}
        <View key="2" style={styles.page}>
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

      <PageIndicator
        currentPage={currentPage}
        onPress={navigateToPage}
        unsortedCount={unsortedNotes.length}
      />
    </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  pager: {
    flex: 1,
  },
  page: {
    flex: 1,
  },
});
