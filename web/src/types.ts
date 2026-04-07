export type ViewName = 'buffer' | 'board' | 'graph';

export interface Category {
  id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface Note {
  id: string;
  text: string;
  created_at: string;
  updated_at: string;
  category_id: string | null;
  color: string | null;
  remind_at: string | null;
  pending_review: boolean;
  pinned: boolean;
  archived_at: string | null;
}

export interface NoteConnection {
  id: string;
  source_note_id: string;
  target_note_id: string;
  created_at: string;
}
