import { useState, useCallback, useEffect, useMemo } from 'react';
import type { ViewName, Note } from './types';
import { useAuth } from './hooks/useAuth';
import { useNotes } from './hooks/useNotes';
import { useCategories } from './hooks/useCategories';
import { useToast } from './components/Toast';
import { subscribeToPush, unsubscribeFromPush, getPushStatus } from './lib/push';
import { registerOutboxSync } from './lib/bgsync';
import { BootSequence } from './components/BootSequence';
import { DataLoadingScreen } from './components/DataLoadingScreen';
import { LoginScreen } from './components/LoginScreen';
import { AppHeader } from './components/AppHeader';
import { BottomNav } from './components/BottomNav';
import { CaptureBar } from './components/CaptureBar';
import { CommandPalette, type Command } from './components/CommandPalette';
import { ShortcutsOverlay } from './components/ShortcutsOverlay';
import { OnboardingOverlay } from './components/OnboardingOverlay';
import { ConnectionError } from './components/ConnectionError';
import { BufferView } from './views/BufferView';
import { BoardView } from './views/BoardView';
import { SearchView } from './views/SearchView';
import { SettingsView } from './views/SettingsView';
import { ArchiveView } from './views/ArchiveView';
import { ReviewView } from './views/ReviewView';
import { buildReviewSet } from './lib/review';
import { exportJson, exportMarkdown } from './lib/exporter';
import './App.css';

export default function App() {
  const { showToast } = useToast();
  const { user, loading: authLoading, signIn, signUp, signInAsGuest, upgradeGuest, signOut } = useAuth();
  const [booted, setBooted] = useState(() => sessionStorage.getItem('cn_booted') === '1');
  const [activeView, setActiveView] = useState<ViewName>('buffer');
  const [theme, setTheme] = useState<'dark' | 'light'>(() =>
    (localStorage.getItem('cn_theme') as 'dark' | 'light') || 'dark'
  );
  const [accent, setAccent] = useState<string>(() =>
    localStorage.getItem('cn_accent') || 'green'
  );
  const [pushStatus, setPushStatus] = useState<'unsupported' | 'denied' | 'subscribed' | 'unsubscribed'>('unsubscribed');

  // Focus-a-note plumbing (search → open the actual note).
  const [focusNoteId, setFocusNoteId] = useState<string | null>(null);
  const [boardFocusCatId, setBoardFocusCatId] = useState<string | null>(null);
  const [focusNonce, setFocusNonce] = useState(0);

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(() => !localStorage.getItem('cn_onboarded'));

  const onNotesError = useCallback((msg: string) => showToast('error', msg), [showToast]);
  const onCatsError = useCallback((msg: string) => showToast('error', msg), [showToast]);

  // Fetch data as soon as the user is known, so it loads *during* the boot
  // animation instead of behind a second loading screen.
  const {
    notes,
    archived,
    unsortedNotes,
    loading: notesLoading,
    error: notesError,
    pendingCount,
    createNote,
    updateNote,
    archiveNote,
    unarchiveNote,
    deleteNote,
    getNotesByCategory,
    fetchArchived,
    flushOutbox,
    refetch: refetchNotes,
  } = useNotes(!!user, onNotesError);

  const {
    categories,
    loading: catsLoading,
    error: catsError,
    createCategory,
    updateCategory,
    deleteCategory,
    refetch: refetchCategories,
  } = useCategories(!!user, onCatsError);

  const reviewCount = useMemo(() => buildReviewSet(notes, Date.now()).count, [notes]);

  const navigate = useCallback((view: ViewName) => {
    setFocusNoteId(null);
    setBoardFocusCatId(null);
    setActiveView(view);
  }, []);

  const handleCommit = useCallback(
    async (text: string, categoryId?: string) => {
      try {
        await createNote(text, categoryId);
        // Captured offline → ask the SW to flush the outbox once we reconnect,
        // even if this tab is backgrounded by then (see lib/bgsync.ts).
        if (!navigator.onLine) void registerOutboxSync();
        if (activeView !== 'buffer') {
          const cat = categoryId ? categories.find(c => c.id === categoryId) : null;
          showToast('ok', `cached → ${cat ? '/' + cat.name.toLowerCase() : 'buffer'}`);
        }
      } catch (e) {
        // Local capture failed (storage disabled/full) — the note is NOT saved.
        // Rethrow so the CaptureBar keeps the text for the user to retry.
        showToast('error', 'could not cache note — kept in editor');
        throw e;
      }
    },
    [createNote, categories, activeView, showToast]
  );

  const handleDelete = useCallback(
    (id: string) => {
      archiveNote(id)
        .then(removed => {
          if (removed) {
            showToast('ok', 'note archived', {
              actionLabel: 'undo',
              onAction: () => {
                unarchiveNote(removed).catch(() => showToast('error', 'failed to restore note'));
              },
            });
          }
        })
        .catch(() => showToast('error', 'failed to delete note'));
    },
    [archiveNote, unarchiveNote, showToast]
  );

  const handleOpenNote = useCallback((note: Note) => {
    setBoardFocusCatId(note.category_id);
    setFocusNoteId(note.id);
    setFocusNonce(n => n + 1);
    setActiveView(note.category_id ? 'board' : 'buffer');
  }, []);

  const handleOpenCategory = useCallback((catId: string) => {
    setBoardFocusCatId(catId);
    setFocusNoteId(null);
    setFocusNonce(n => n + 1);
    setActiveView('board');
  }, []);

  const handleOpenArchive = useCallback(() => {
    fetchArchived();
    navigate('archive');
  }, [fetchArchived, navigate]);

  const focusCapture = useCallback(() => {
    navigate('buffer');
    setTimeout(() => (document.querySelector('.capture-bar__input') as HTMLTextAreaElement | null)?.focus(), 60);
  }, [navigate]);

  const dismissOnboarding = useCallback(() => {
    localStorage.setItem('cn_onboarded', '1');
    setShowOnboarding(false);
  }, []);

  const handleRetry = useCallback(() => { refetchNotes(); refetchCategories(); }, [refetchNotes, refetchCategories]);

  const handleExportJson = useCallback(() => exportJson(notes, categories, new Date().toISOString()), [notes, categories]);
  const handleExportMarkdown = useCallback(() => exportMarkdown(notes, categories, new Date().toISOString()), [notes, categories]);

  const handleUpgradeAccount = useCallback(async (email: string, password: string) => {
    const result = await upgradeGuest(email, password);
    if (!result.error) showToast('ok', 'account created — notes saved');
    return result;
  }, [upgradeGuest, showToast]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('cn_theme', theme);
  }, [theme]);

  useEffect(() => {
    if (accent === 'green') {
      document.documentElement.removeAttribute('data-accent');
    } else {
      document.documentElement.setAttribute('data-accent', accent);
    }
    localStorage.setItem('cn_accent', accent);
  }, [accent]);

  useEffect(() => {
    if (activeView === 'settings') {
      getPushStatus().then(setPushStatus);
    }
    if (activeView === 'settings' || activeView === 'archive') {
      fetchArchived();
    }
  }, [activeView, fetchArchived]);

  useEffect(() => {
    const onOffline = () => { showToast('warn', 'connection lost — you are offline'); void registerOutboxSync(); };
    const onOnline = () => { showToast('ok', 'back online'); flushOutbox(); };
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
    };
  }, [showToast, flushOutbox]);

  // On a Background Sync wake-up the service worker postMessages the page
  // (it can't reach the outbox/session itself — see sw.ts / lib/bgsync.ts);
  // flush the outbox when it does.
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const onMessage = (e: MessageEvent) => {
      if ((e.data as { type?: string } | null)?.type === 'cn-flush') flushOutbox();
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, [flushOutbox]);

  const handleEnableNotifications = useCallback(async () => {
    const { error } = await subscribeToPush();
    if (error) showToast('error', error);
    else { showToast('ok', 'notifications enabled'); setPushStatus('subscribed'); }
  }, [showToast]);

  const handleDisableNotifications = async () => {
    const { error } = await unsubscribeFromPush();
    if (error) showToast('error', error);
    else { showToast('ok', 'notifications disabled'); setPushStatus('unsubscribed'); }
  };

  // Command palette entries.
  const commands: Command[] = useMemo(() => {
    const base: Command[] = [
      { id: 'go-buffer', label: 'go: buffer', hint: '1', run: () => navigate('buffer') },
      { id: 'go-board', label: 'go: board', hint: '2', run: () => navigate('board') },
      { id: 'go-search', label: 'go: search', hint: '3', run: () => navigate('search') },
      { id: 'go-review', label: 'go: review', hint: '4', run: () => navigate('review') },
      { id: 'go-settings', label: 'go: settings', hint: '⚙', run: () => navigate('settings') },
      { id: 'new-note', label: 'new note', hint: 'n', run: focusCapture },
      { id: 'toggle-theme', label: `theme: switch to ${theme === 'dark' ? 'light' : 'dark'}`, run: () => setTheme(t => (t === 'dark' ? 'light' : 'dark')) },
      { id: 'open-archive', label: 'open: ~/.trash (archived notes)', run: handleOpenArchive },
      { id: 'shortcuts', label: 'show keyboard shortcuts', hint: '?', run: () => setShortcutsOpen(true) },
    ];
    if (pushStatus === 'unsubscribed') {
      base.push({ id: 'enable-notif', label: 'enable notifications', run: handleEnableNotifications });
    }
    const catCmds: Command[] = categories.map(c => ({
      id: `cat-${c.id}`,
      label: `open: /${c.name.toLowerCase()}`,
      run: () => handleOpenCategory(c.id),
    }));
    return [...base, ...catCmds];
  }, [categories, theme, pushStatus, navigate, focusCapture, handleOpenArchive, handleOpenCategory, handleEnableNotifications]);

  // Global keyboard shortcuts.
  useEffect(() => {
    if (!user || !booted) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setPaletteOpen(o => !o);
        return;
      }
      if (paletteOpen || shortcutsOpen) return;
      const el = e.target as HTMLElement | null;
      const typing = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      switch (e.key) {
        case '1': navigate('buffer'); break;
        case '2': navigate('board'); break;
        case '3': navigate('search'); break;
        case '4': navigate('review'); break;
        case '/': e.preventDefault(); navigate('search'); break;
        case 'n': case 'N': e.preventDefault(); focusCapture(); break;
        case '?': e.preventDefault(); setShortcutsOpen(true); break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [user, booted, paletteOpen, shortcutsOpen, navigate, focusCapture]);

  if (authLoading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'var(--bg)',
        color: 'var(--accent)',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '14px',
      }}>
        authenticating...
      </div>
    );
  }

  if (!user) {
    return <LoginScreen onSignIn={signIn} onSignUp={signUp} onGuest={signInAsGuest} />;
  }

  if (!booted) {
    return <BootSequence onDone={() => { sessionStorage.setItem('cn_booted', '1'); setBooted(true); }} />;
  }

  if (notesLoading || catsLoading) {
    return <DataLoadingScreen />;
  }

  if ((notesError && notes.length === 0) || (catsError && categories.length === 0)) {
    return <ConnectionError onRetry={handleRetry} />;
  }

  return (
    <div className="app-shell">
      <AppHeader
        totalNotes={notes.length}
        unsortedCount={unsortedNotes.length}
        reviewCount={reviewCount}
        pendingCount={pendingCount}
        isGuest={!!user.is_anonymous}
        onOpenReview={() => navigate('review')}
        onOpenSettings={() => navigate('settings')}
      />
      <div className="app-shell__content">
        {activeView === 'buffer' && (
          <BufferView
            notes={unsortedNotes}
            categories={categories}
            focusNoteId={focusNoteId}
            focusNonce={focusNonce}
            onAssign={(noteId, categoryId) =>
              updateNote(noteId, { category_id: categoryId }).catch(() =>
                showToast('error', 'failed to assign note')
              )
            }
            onDelete={handleDelete}
            onUpdate={(id, updates) =>
              updateNote(id, updates).catch(() => showToast('error', 'failed to update note'))
            }
          />
        )}
        {activeView === 'board' && (
          <BoardView
            categories={categories}
            getNotesByCategory={getNotesByCategory}
            focusNoteId={focusNoteId}
            focusNonce={focusNonce}
            initialCatId={boardFocusCatId}
            onUpdateNote={(id, updates) =>
              updateNote(id, updates).catch(() => showToast('error', 'failed to update note'))
            }
            onDeleteNote={handleDelete}
            onCreateCategory={(name) =>
              createCategory(name).catch(() => showToast('error', 'failed to create directory'))
            }
            onRenameCategory={(id, name) =>
              updateCategory(id, { name }).catch(() => showToast('error', 'failed to rename directory'))
            }
            onDeleteCategory={(id) =>
              deleteCategory(id).catch(() => showToast('error', 'failed to delete directory'))
            }
            onSetCategoryColor={(id, color) =>
              updateCategory(id, { color }).catch(() => showToast('error', 'failed to set color'))
            }
          />
        )}
        {activeView === 'search' && (
          <SearchView
            notes={notes}
            categories={categories}
            onOpenNote={handleOpenNote}
          />
        )}
        {activeView === 'settings' && (
          <SettingsView
            userEmail={user.is_anonymous ? 'guest' : (user.email ?? '')}
            isGuest={!!user.is_anonymous}
            theme={theme}
            accent={accent}
            onThemeChange={setTheme}
            onAccentChange={setAccent}
            onSignOut={signOut}
            pushStatus={pushStatus}
            onEnableNotifications={handleEnableNotifications}
            onDisableNotifications={handleDisableNotifications}
            onOpenArchive={handleOpenArchive}
            archivedCount={archived.length}
            onExportJson={handleExportJson}
            onExportMarkdown={handleExportMarkdown}
            onUpgradeAccount={user.is_anonymous ? handleUpgradeAccount : undefined}
          />
        )}
        {activeView === 'review' && (
          <ReviewView
            notes={notes}
            categories={categories}
            onAssign={(noteId, categoryId) =>
              updateNote(noteId, { category_id: categoryId }).catch(() =>
                showToast('error', 'failed to assign note')
              )
            }
            onDelete={handleDelete}
            onUpdate={(id, updates) =>
              updateNote(id, updates).catch(() => showToast('error', 'failed to update note'))
            }
          />
        )}
        {activeView === 'archive' && (
          <ArchiveView
            archived={archived}
            categories={categories}
            onRestore={(note) =>
              unarchiveNote(note).catch(() => showToast('error', 'failed to restore note'))
            }
            onPurge={(id) =>
              deleteNote(id).catch(() => showToast('error', 'failed to delete note'))
            }
            onBack={() => navigate('settings')}
          />
        )}
      </div>
      {activeView !== 'settings' && activeView !== 'archive' && (
        <CaptureBar categories={categories} onCommit={handleCommit} />
      )}
      <BottomNav
        activeView={activeView}
        unsortedCount={unsortedNotes.length}
        reviewCount={reviewCount}
        onTabClick={navigate}
      />

      <CommandPalette open={paletteOpen} commands={commands} onClose={() => setPaletteOpen(false)} />
      <ShortcutsOverlay open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <OnboardingOverlay open={showOnboarding} onDismiss={dismissOnboarding} />
    </div>
  );
}
