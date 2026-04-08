import { useState, useCallback, useEffect } from 'react';
import type { ViewName } from './types';
import { useAuth } from './hooks/useAuth';
import { useNotes } from './hooks/useNotes';
import { useCategories } from './hooks/useCategories';
import { useToast } from './components/Toast';
import { subscribeToPush, unsubscribeFromPush, getPushStatus } from './lib/push';
import { BootSequence } from './components/BootSequence';
import { DataLoadingScreen } from './components/DataLoadingScreen';
import { LoginScreen } from './components/LoginScreen';
import { StatusBar } from './components/StatusBar';
import { CaptureBar } from './components/CaptureBar';
import { BufferView } from './views/BufferView';
import { BoardView } from './views/BoardView';
import { SearchView } from './views/SearchView';
import { SettingsView } from './views/SettingsView';
import './App.css';

export default function App() {
  const { showToast } = useToast();
  const { user, loading: authLoading, signIn, signUp, signOut } = useAuth();
  const [booted, setBooted] = useState(false);
  const [activeView, setActiveView] = useState<ViewName>('buffer');
  const [theme, setTheme] = useState<'dark' | 'light'>(() =>
    (localStorage.getItem('cn_theme') as 'dark' | 'light') || 'dark'
  );
  const [accent, setAccent] = useState<string>(() =>
    localStorage.getItem('cn_accent') || 'green'
  );
  const [pushStatus, setPushStatus] = useState<'unsupported' | 'denied' | 'subscribed' | 'unsubscribed'>('unsubscribed');

  const onNotesError = useCallback(
    (msg: string) => showToast('error', msg),
    [showToast]
  );

  const onCatsError = useCallback(
    (msg: string) => showToast('error', msg),
    [showToast]
  );

  const {
    notes,
    unsortedNotes,
    loading: notesLoading,
    createNote,
    updateNote,
    deleteNote,
    getNotesByCategory,
  } = useNotes(booted, onNotesError);

  const {
    categories,
    loading: catsLoading,
    createCategory,
    updateCategory,
    deleteCategory,
  } = useCategories(booted, onCatsError);

  const handleCommit = useCallback(
    (text: string, categoryId?: string) => {
      createNote(text, categoryId).catch(() =>
        showToast('error', 'failed to create note')
      );
    },
    [createNote, showToast]
  );

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
  }, [activeView]);

  const handleEnableNotifications = async () => {
    const { error } = await subscribeToPush();
    if (error) showToast('error', error);
    else { showToast('ok', 'notifications enabled'); setPushStatus('subscribed'); }
  };

  const handleDisableNotifications = async () => {
    const { error } = await unsubscribeFromPush();
    if (error) showToast('error', error);
    else { showToast('ok', 'notifications disabled'); setPushStatus('unsubscribed'); }
  };

  if (authLoading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: '#1a1a1a',
        color: '#39FF14',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '14px',
      }}>
        loading...
      </div>
    );
  }

  if (!user) {
    return <LoginScreen onSignIn={signIn} onSignUp={signUp} />;
  }

  if (!booted) {
    return <BootSequence onDone={() => setBooted(true)} />;
  }

  if (notesLoading || catsLoading) {
    return <DataLoadingScreen />;
  }

  return (
    <div className="app-shell">
      <StatusBar
        activeView={activeView}
        unsortedCount={unsortedNotes.length}
        onTabClick={setActiveView}
      />
      <div className="app-shell__content">
        {activeView === 'buffer' && (
          <BufferView
            notes={unsortedNotes}
            categories={categories}
            onAssign={(noteId, categoryId) =>
              updateNote(noteId, { category_id: categoryId }).catch(() =>
                showToast('error', 'failed to assign note')
              )
            }
            onDelete={(id) =>
              deleteNote(id).catch(() =>
                showToast('error', 'failed to delete note')
              )
            }
            onUpdate={(id, updates) =>
              updateNote(id, updates).catch(() =>
                showToast('error', 'failed to update note')
              )
            }
          />
        )}
        {activeView === 'board' && (
          <BoardView
            categories={categories}
            getNotesByCategory={getNotesByCategory}
            onUpdateNote={(id, updates) =>
              updateNote(id, updates).catch(() =>
                showToast('error', 'failed to update note')
              )
            }
            onDeleteNote={(id) =>
              deleteNote(id).catch(() =>
                showToast('error', 'failed to delete note')
              )
            }
            onCreateCategory={(name) =>
              createCategory(name).catch(() =>
                showToast('error', 'failed to create directory')
              )
            }
            onRenameCategory={(id, name) =>
              updateCategory(id, { name }).catch(() =>
                showToast('error', 'failed to rename directory')
              )
            }
            onDeleteCategory={(id) =>
              deleteCategory(id).catch(() =>
                showToast('error', 'failed to delete directory')
              )
            }
          />
        )}
        {activeView === 'search' && (
          <SearchView
            notes={notes}
            categories={categories}
            onNavigate={setActiveView}
          />
        )}
        {activeView === 'settings' && (
          <SettingsView
            userEmail={user.email ?? ''}
            theme={theme}
            accent={accent}
            onThemeChange={setTheme}
            onAccentChange={setAccent}
            onSignOut={signOut}
            pushStatus={pushStatus}
            onEnableNotifications={handleEnableNotifications}
            onDisableNotifications={handleDisableNotifications}
          />
        )}
      </div>
      {activeView !== 'settings' && (
        <CaptureBar categories={categories} onCommit={handleCommit} />
      )}
    </div>
  );
}
