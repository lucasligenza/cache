export type ViewName = 'buffer' | 'board' | 'search' | 'settings' | 'archive' | 'review';

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
  reviewed_at: string | null;
  /** Client-only: captured locally but not yet confirmed by the server. Never persisted. */
  pending?: boolean;
}
