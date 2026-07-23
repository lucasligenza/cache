import type { Note, Category } from '../types';
import { NoteCard } from '../components/NoteCard';
import { buildReviewSet, countReviewedToday, type ReviewBucketKey } from '../lib/review';
import './ReviewView.css';

interface Props {
  notes: Note[];
  categories: Category[];
  onAssign: (noteId: string, categoryId: string) => void;
  onDelete: (noteId: string) => void;
  onUpdate: (id: string, updates: Partial<Note>) => void;
}

const BUCKET_META: Record<ReviewBucketKey, { icon: string; label: string; mod: string }> = {
  overdue:    { icon: '⚠', label: 'overdue ping',        mod: 'overdue' },
  flagged:    { icon: '⚑', label: 'flagged for review',  mod: 'flagged' },
  stale:      { icon: '◷', label: 'stale in buffer',     mod: 'stale' },
  resurfaced: { icon: '↻', label: 'resurfaced',          mod: 'resurfaced' },
};

export function ReviewView({ notes, categories, onAssign, onDelete, onUpdate }: Props) {
  const now = Date.now();
  const { buckets, count, actionable } = buildReviewSet(notes, now);
  const clearedToday = countReviewedToday(notes, now);

  // Honest header: `count` includes resurfaced, so "all clear" only shows when the
  // review set is truly empty. Resurfaced-only reads as a gentle "to revisit".
  const headerLabel =
    count === 0 ? 'all clear' : actionable > 0 ? `${count} need attention` : `${count} to revisit`;

  return (
    <div className="review-view">
      <div className="review-view__label">
        ── review ── {headerLabel}
      </div>

      {buckets.length === 0 ? (
        <div className="review-view__empty">
          <div className="review-view__empty-line">$ inbox zero — all caught up ✓</div>
          <div className="review-view__empty-hint">
            {clearedToday > 0 ? `cleared ${clearedToday} today` : 'nothing to review right now'}
          </div>
        </div>
      ) : (
        buckets.map(bucket => {
          const meta = BUCKET_META[bucket.key];
          return (
            <section key={bucket.key} className="review-view__group">
              <div className={`review-view__group-label review-view__group-label--${meta.mod}`}>
                {meta.icon} {meta.label} · {bucket.notes.length}
              </div>
              {bucket.notes.map(note => (
                <NoteCard
                  key={note.id}
                  note={note}
                  categories={categories.filter(c => c.id !== note.category_id)}
                  onAssign={onAssign}
                  onDelete={onDelete}
                  onUpdate={onUpdate}
                  showCategories
                  reviewMode
                />
              ))}
            </section>
          );
        })
      )}
    </div>
  );
}
