import type { Note, Category } from '../types';

interface Props {
  notes: Note[];
  categories: Category[];
  onNavigate: (view: 'buffer' | 'board') => void;
}

export function SearchView(_props: Props) {
  return null;
}
