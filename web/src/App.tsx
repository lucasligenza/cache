import { useState, useCallback } from 'react';
import { ViewName } from './types';
import { useNotes } from './hooks/useNotes';
import { useCategories } from './hooks/useCategories';
import { BootSequence } from './components/BootSequence';
import { DataLoadingScreen } from './components/DataLoadingScreen';
import { StatusBar } from './components/StatusBar';
import { CaptureBar } from './components/CaptureBar';
import { BufferView } from './views/BufferView';
import { BoardView } from './views/BoardView';
import { GraphView } from './views/GraphView';
import './App.css';

export default function App() {
  const [booted, setBooted] = useState(false);
  const [activeView, setActiveView] = useState<ViewName>('buffer');

  const {
    notes,
    unsortedNotes,
    loading: notesLoading,
    createNote,
    updateNote,
    deleteNote,
    getNotesByCategory,
  } = useNotes(booted);

  const {
    categories,
    loading: catsLoading,
    createCategory,
    updateCategory,
    deleteCategory,
  } = useCategories(booted);

  const handleCommit = useCallback(
    (text: string, categoryId?: string) => {
      createNote(text, categoryId).catch(console.error);
    },
    [createNote]
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
              updateNote(noteId, { category_id: categoryId }).catch(console.error)
            }
            onDelete={deleteNote}
          />
        )}
        {activeView === 'board' && (
          <BoardView
            categories={categories}
            getNotesByCategory={getNotesByCategory}
            onUpdateNote={updateNote}
            onDeleteNote={deleteNote}
            onCreateCategory={(name) => createCategory(name).catch(console.error)}
            onRenameCategory={(id, name) =>
              updateCategory(id, { name }).catch(console.error)
            }
            onDeleteCategory={(id) => deleteCategory(id).catch(console.error)}
          />
        )}
        {activeView === 'graph' && (
          <GraphView allNotes={notes} categories={categories} />
        )}
      </div>
      <CaptureBar categories={categories} onCommit={handleCommit} />
    </div>
  );
}
