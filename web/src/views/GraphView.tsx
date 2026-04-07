import { useState, useEffect } from 'react';
import { Note, Category } from '../types';
import { useNoteConnections } from '../hooks/useNoteConnections';
import './GraphView.css';

const ORBIT_RADIUS = 160;
const CENTER_X = 280;
const CENTER_Y = 200;

function nodePosition(index: number, total: number) {
  const count = total + 1;
  const angle = (2 * Math.PI / count) * index - Math.PI / 2;
  return {
    x: CENTER_X + ORBIT_RADIUS * Math.cos(angle),
    y: CENTER_Y + ORBIT_RADIUS * Math.sin(angle),
  };
}

interface EdgeProps {
  x1: number; y1: number; x2: number; y2: number;
}

function Edge({ x1, y1, x2, y2 }: EdgeProps) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx) * 180 / Math.PI;
  return (
    <div
      className="graph-edge"
      style={{
        left: x1,
        top: y1,
        width: length,
        transform: `rotate(${angle}deg)`,
      }}
    />
  );
}

interface Props {
  allNotes: Note[];
  categories: Category[];
}

export function GraphView({ allNotes, categories: _categories }: Props) {
  const [rootNote, setRootNote] = useState<Note | null>(null);
  const [linkSheetOpen, setLinkSheetOpen] = useState(false);
  const { connections, fetchConnections, addConnection, removeConnection } = useNoteConnections();

  useEffect(() => {
    if (rootNote) fetchConnections(rootNote.id);
  }, [rootNote, fetchConnections]);

  if (!rootNote) {
    return (
      <div className="graph-view">
        <div className="graph-view__label">── graph ── select a note</div>
        <div className="graph-view__empty">click a note to explore its connections</div>
        <div className="graph-view__note-list">
          {allNotes.slice(0, 12).map(note => (
            <button
              key={note.id}
              className="graph-view__note-item"
              onClick={() => setRootNote(note)}
            >
              {note.text}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const availableToLink = allNotes.filter(
    n => n.id !== rootNote.id && !connections.some(c => c.id === n.id)
  );
  const addPos = nodePosition(connections.length, connections.length);

  return (
    <div className="graph-view">
      <div className="graph-view__label">
        ── graph ── {connections.length} connections
        <button
          onClick={() => setRootNote(null)}
          style={{ marginLeft: 16, background: 'none', border: 'none', color: 'var(--text-dim)', fontFamily: 'var(--font)', fontSize: 10, cursor: 'pointer' }}
        >
          ← back
        </button>
      </div>

      <div className="graph-view__canvas">
        {connections.map((conn, i) => {
          const pos = nodePosition(i, connections.length);
          return (
            <Edge key={conn.id} x1={CENTER_X} y1={CENTER_Y} x2={pos.x} y2={pos.y} />
          );
        })}

        <div className="graph-node graph-node--root" style={{ left: CENTER_X, top: CENTER_Y }}>
          <div className="graph-node__text">{rootNote.text}</div>
        </div>

        {connections.map((conn, i) => {
          const pos = nodePosition(i, connections.length);
          return (
            <div
              key={conn.id}
              className="graph-node"
              style={{ left: pos.x, top: pos.y }}
              onClick={() => setRootNote(conn)}
            >
              <div className="graph-node__text">{conn.text}</div>
              <button
                className="graph-node__action"
                onClick={e => {
                  e.stopPropagation();
                  removeConnection(rootNote.id, conn.id).then(() => fetchConnections(rootNote.id));
                }}
              >
                unlink
              </button>
            </div>
          );
        })}

        {availableToLink.length > 0 && (
          <div
            className="graph-node graph-node--add"
            style={{ left: addPos.x, top: addPos.y, width: 130, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={() => setLinkSheetOpen(o => !o)}
          >
            + link
          </div>
        )}
      </div>

      {linkSheetOpen && (
        <div className="graph-view__link-sheet">
          <div className="graph-view__link-label">link a note</div>
          {availableToLink.slice(0, 10).map(note => (
            <div key={note.id} className="graph-view__link-item">
              <span className="graph-view__link-text">{note.text}</span>
              <button
                className="graph-view__link-btn"
                onClick={() => {
                  addConnection(rootNote.id, note.id).then(() => {
                    fetchConnections(rootNote.id);
                    setLinkSheetOpen(false);
                  });
                }}
              >
                link
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
