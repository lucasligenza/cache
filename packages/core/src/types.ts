// Shared data types — the shape of what lives in Supabase. Platform-agnostic:
// consumed by both the web app and (soon) the native app. UI-only types like
// ViewName stay in their platform package.

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
  /** "Never nag": excludes the note from passive review buckets (stale, resurfaced). */
  review_muted?: boolean;
  /** Client-only: captured locally but not yet confirmed by the server. Never persisted. */
  pending?: boolean;
}
