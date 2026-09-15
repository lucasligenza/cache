export type { Note, Category } from '@cache/core';

export interface NoteConnection {
  id: string;
  source_note_id: string;
  target_note_id: string;
  created_at: string;
}
