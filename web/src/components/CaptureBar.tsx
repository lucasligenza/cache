import { useRef, useState, useEffect, useCallback, useId } from 'react';
import { Category } from '../types';
import { parseSlashRoute } from '../lib/slashRoute';
import { useToast } from './Toast';
import './CaptureBar.css';

interface Props {
  categories: Category[];
  onCommit: (text: string, categoryId?: string) => Promise<void>;
}

export function CaptureBar({ categories, onCommit }: Props) {
  const [text, setText] = useState('');
  const [focused, setFocused] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerIndex, setPickerIndex] = useState(0);
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { showToast } = useToast();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const listboxId = useId();
  const optionId = (idx: number) => `${listboxId}-opt-${idx}`;

  const slashRoute = parseSlashRoute(text, categories);

  const selectedCat = selectedCatId ? categories.find(c => c.id === selectedCatId) : null;
  const targetCat = slashRoute.kind === 'match' ? slashRoute.category : selectedCat;
  const catLabel = targetCat ? `→ /${targetCat.name.toLowerCase()}` : '→ buffer';

  // buffer(null) + each category, for keyboard navigation of the picker
  const pickerOptions: (Category | null)[] = [null, ...categories];

  useEffect(() => { textareaRef.current?.focus(); }, []);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${e.target.scrollHeight}px`;
  };

  const handleCommit = useCallback(async () => {
    if (submitting) return; // guard against double-submit while the save is in flight
    let body = text.trim();
    let catId: string | undefined = selectedCatId ?? undefined;

    // Slash-routing. Never silently drop or mutate a thought:
    //  - known /dir with a body → route to that category
    //  - known /dir with no body → hint, keep the text (nothing to cache yet)
    //  - unknown /dir → file the note verbatim to buffer and say so
    const route = parseSlashRoute(text, categories);
    if (route.kind === 'match') {
      if (!route.body) {
        showToast('warn', `add a note after /${route.category.name.toLowerCase()}`);
        return;
      }
      body = route.body;
      catId = route.category.id;
    } else if (route.kind === 'unknown') {
      showToast('warn', `no category '${route.token}' — filed to buffer`);
      body = text.trim();
      catId = undefined;
    }
    if (!body) return;

    setSubmitting(true);
    try {
      await onCommit(body, catId);
      // Only now is the thought durably captured — safe to clear the editor.
      setText('');
      setSelectedCatId(null);
      setPickerOpen(false);
      setFlash(true);
      window.setTimeout(() => setFlash(false), 900);
      const ta = textareaRef.current;
      if (ta) ta.style.height = 'auto';
    } catch {
      // Keep the text exactly as typed so the user can retry — nothing is lost.
    } finally {
      setSubmitting(false);
      textareaRef.current?.focus();
    }
  }, [text, selectedCatId, categories, onCommit, showToast, submitting]);

  const selectByIndex = useCallback((idx: number) => {
    const opt = pickerOptions[idx];
    setSelectedCatId(opt ? opt.id : null);
    setPickerOpen(false);
    textareaRef.current?.focus();
  }, [pickerOptions]);

  const openPicker = () => {
    const current = selectedCatId ? pickerOptions.findIndex(o => o?.id === selectedCatId) : 0;
    setPickerIndex(current < 0 ? 0 : current);
    setPickerOpen(true);
  };

  // Arrow/Enter/Escape navigation while the picker is open. Tab closes it but is
  // never swallowed, so focus can always move on (WCAG 2.1.2 No Keyboard Trap).
  const handlePickerKeys = (e: React.KeyboardEvent): boolean => {
    if (!pickerOpen) return false;
    if (e.key === 'ArrowDown') { e.preventDefault(); setPickerIndex(i => Math.min(i + 1, pickerOptions.length - 1)); return true; }
    if (e.key === 'ArrowUp') { e.preventDefault(); setPickerIndex(i => Math.max(i - 1, 0)); return true; }
    if (e.key === 'Enter') { e.preventDefault(); selectByIndex(pickerIndex); return true; }
    if (e.key === 'Escape') { e.preventDefault(); setPickerOpen(false); return true; }
    if (e.key === 'Tab') { setPickerOpen(false); return true; }
    return false;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (handlePickerKeys(e)) return;
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleCommit();
    }
    // Tab is a shortcut to the picker only once there's something to file;
    // on an empty field (the default focus) and with Shift it moves focus.
    if (e.key === 'Tab' && !e.shiftKey && !e.altKey && !e.ctrlKey && !e.metaKey && text.trim()) {
      e.preventDefault();
      openPicker();
    }
    if (e.key === 'Escape') {
      setPickerOpen(false);
    }
  };

  const handleCatBtnKeyDown = (e: React.KeyboardEvent) => {
    if (handlePickerKeys(e)) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      openPicker();
    }
  };

  const selectCategory = (catId: string | null) => {
    setSelectedCatId(catId);
    setPickerOpen(false);
    textareaRef.current?.focus();
  };

  return (
    <div className={`capture-bar${focused ? ' capture-bar--focused' : ''}`}>
      <div className="capture-bar__prompt-row">
        <span className="capture-bar__prompt">~/cache $</span>
        <textarea
          ref={textareaRef}
          className="capture-bar__input"
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          aria-controls={pickerOpen ? listboxId : undefined}
          aria-activedescendant={pickerOpen ? optionId(pickerIndex) : undefined}
          onFocus={() => {
            setFocused(true);
            // iOS pans the document to the focused field; the shell is pinned
            // to visualViewport, so a leftover window scroll would jump layout.
            window.scrollTo(0, 0);
          }}
          onBlur={() => setFocused(false)}
          placeholder="type a note..."
          rows={1}
          enterKeyHint="send"
        />
        {flash && <span className="capture-bar__cached">cached ✓</span>}
      </div>

      <div className="capture-bar__footer">
        <div className="capture-bar__cat-wrap">
          <button
            type="button"
            role="combobox"
            aria-label="file to"
            aria-haspopup="listbox"
            aria-expanded={pickerOpen}
            aria-controls={pickerOpen ? listboxId : undefined}
            aria-activedescendant={pickerOpen ? optionId(pickerIndex) : undefined}
            className="capture-bar__cat-btn"
            onClick={() => (pickerOpen ? setPickerOpen(false) : openPicker())}
            onKeyDown={handleCatBtnKeyDown}
            style={targetCat ? { color: targetCat.color, borderColor: targetCat.color + '55' } : undefined}
          >
            {catLabel}
          </button>

          {pickerOpen && (
            <div className="capture-bar__picker" role="listbox" id={listboxId} aria-label="category">
              <button
                type="button"
                role="option"
                id={optionId(0)}
                aria-selected={pickerIndex === 0}
                tabIndex={-1}
                className={`capture-bar__picker-item${pickerIndex === 0 ? ' capture-bar__picker-item--active' : ''}`}
                style={{ color: 'var(--text-muted)' }}
                onClick={() => selectCategory(null)}
              >
                → buffer
              </button>
              {categories.map((cat, i) => (
                <button
                  key={cat.id}
                  type="button"
                  role="option"
                  id={optionId(i + 1)}
                  aria-selected={pickerIndex === i + 1}
                  tabIndex={-1}
                  className={`capture-bar__picker-item${pickerIndex === i + 1 ? ' capture-bar__picker-item--active' : ''}`}
                  style={{ color: cat.color }}
                  onClick={() => selectCategory(cat.id)}
                >
                  <span className="capture-bar__picker-swatch" style={{ background: cat.color }} />
                  /{cat.name.toLowerCase()}
                </button>
              ))}
            </div>
          )}
        </div>

        <span className="capture-bar__hint">↵ commit · tab for category · /dir to file</span>

        <button
          className="capture-bar__send-btn"
          onClick={handleCommit}
          aria-label="send"
          type="button"
          disabled={submitting}
          aria-busy={submitting}
        >
          ↵
        </button>
      </div>
    </div>
  );
}
