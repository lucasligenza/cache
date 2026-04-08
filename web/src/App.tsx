import { useState, useCallback } from 'react';
import type { ViewName } from './types';
import { useNotes } from './hooks/useNotes';
import { useCategories } from './hooks/useCategories';
import { useToast } from './components/Toast';
import { BootSequence } from './components/BootSequence';
import { DataLoadingScreen } from './components/DataLoadingScreen';
import { StatusBar } from './components/StatusBar';
import { CaptureBar } from './components/CaptureBar';
import { BufferView } from './views/BufferView';
import { BoardView } from './views/BoardView';
import { SearchView } from './views/SearchView';
import './App.css';

export default function App() {
  const { showToast } = useToast();
  const [booted, setBooted] = useState(false);
  const [activeView, setActiveView] = useState<ViewName>('buffer');

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
      </div>
      <CaptureBar categories={categories} onCommit={handleCommit} />
    </div>
  );
}
