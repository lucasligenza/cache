import { useRef, useState, useEffect, useCallback } from 'react';
import { Category } from '../types';
import './CaptureBar.css';

interface Props {
  categories: Category[];
  onCommit: (text: string, categoryId?: string) => void;
}

export function CaptureBar({ categories, onCommit }: Props) {
  const [text, setText] = useState('');
  const [focused, setFocused] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerIndex, setPickerIndex] = useState(0);
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Detect a leading `/dir ` that matches an existing category and route there.
  const slashMatch = (() => {
    const m = text.match(/^\/(\S+)(?:\s+([\s\S]*))?$/);
    if (!m) return null;
    const cat = categories.find(c => c.name.toLowerCase() === m[1].toLowerCase());
    if (!cat) return null;
    return { cat, body: m[2] ?? '' };
  })();

  const selectedCat = selectedCatId ? categories.find(c => c.id === selectedCatId) : null;
  const targetCat = slashMatch ? slashMatch.cat : selectedCat;
  const catLabel = targetCat ? `→ /${targetCat.name.toLowerCase()}` : '→ buffer';

  // buffer(null) + each category, for keyboard navigation of the picker
  const pickerOptions: (Category | null)[] = [null, ...categories];

  useEffect(() => { textareaRef.current?.focus(); }, []);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${e.target.scrollHeight}px`;
  };

  const handleCommit = useCallback(() => {
    let body = text.trim();
    let catId = selectedCatId ?? undefined;
    if (slashMatch) {
      const routed = slashMatch.body.trim();
      if (!routed) return; // only "/dir" typed, nothing to cache yet
      body = routed;
      catId = slashMatch.cat.id;
    }
    if (!body) return;
    onCommit(body, catId);
    setText('');
    setSelectedCatId(null);
    setPickerOpen(false);
    setFlash(true);
    window.setTimeout(() => setFlash(false), 900);
    const ta = textareaRef.current;
    if (ta) { ta.style.height = 'auto'; ta.focus(); }
  }, [text, selectedCatId, slashMatch, onCommit]);

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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (pickerOpen) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setPickerIndex(i => Math.min(i + 1, pickerOptions.length - 1)); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setPickerIndex(i => Math.max(i - 1, 0)); return; }
      if (e.key === 'Enter') { e.preventDefault(); selectByIndex(pickerIndex); return; }
      if (e.key === 'Escape') { e.preventDefault(); setPickerOpen(false); return; }
      if (e.key === 'Tab') { e.preventDefault(); setPickerOpen(false); return; }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleCommit();
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      openPicker();
    }
    if (e.key === 'Escape') {
      setPickerOpen(false);
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
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="type a note..."
          rows={1}
        />
        {flash && <span className="capture-bar__cached">cached ✓</span>}
        <button
          className="capture-bar__send-btn"
          onClick={handleCommit}
          aria-label="send"
          type="button"
        >
          ↵
        </button>
      </div>

      <div className="capture-bar__footer">
        <div style={{ position: 'relative' }}>
          <button
            className="capture-bar__cat-btn"
            onClick={() => (pickerOpen ? setPickerOpen(false) : openPicker())}
            style={targetCat ? { color: targetCat.color, borderColor: targetCat.color + '55' } : undefined}
          >
            {catLabel}
          </button>

          {pickerOpen && (
            <div className="capture-bar__picker">
              <button
                className={`capture-bar__picker-item${pickerIndex === 0 ? ' capture-bar__picker-item--active' : ''}`}
                style={{ color: 'var(--text-muted)' }}
                onClick={() => selectCategory(null)}
              >
                → buffer
              </button>
              {categories.map((cat, i) => (
                <button
                  key={cat.id}
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
      </div>
    </div>
  );
}
