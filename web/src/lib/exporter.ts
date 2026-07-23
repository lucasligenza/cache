import type { Note, Category } from '../types';
import { buildJson, buildMarkdown } from '@cache/core';

// The pure builders now live in @cache/core (shared with native). Re-exported so
// existing `./exporter` imports keep working. The browser download wrapper is
// web-specific and stays here.
export { buildJson, buildMarkdown } from '@cache/core';

function download(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function exportJson(notes: Note[], categories: Category[], nowIso: string) {
  download(`cachenotes-${nowIso.slice(0, 10)}.json`, buildJson(notes, categories, nowIso), 'application/json');
}

export function exportMarkdown(notes: Note[], categories: Category[], nowIso: string) {
  download(`cachenotes-${nowIso.slice(0, 10)}.md`, buildMarkdown(notes, categories, nowIso), 'text/markdown');
}
