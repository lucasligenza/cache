export type ViewName = 'buffer' | 'board' | 'search' | 'settings';

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
