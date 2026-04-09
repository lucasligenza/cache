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
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const selectedCat = selectedCatId ? categories.find(c => c.id === selectedCatId) : null;
  const catLabel = selectedCat ? `→ /${selectedCat.name.toLowerCase()}` : '→ buffer';

  useEffect(() => { textareaRef.current?.focus(); }, []);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${e.target.scrollHeight}px`;
  };

  const handleCommit = useCallback(() => {
    if (!text.trim()) return;
    onCommit(text.trim(), selectedCatId ?? undefined);
    setText('');
    setSelectedCatId(null);
    setPickerOpen(false);
    const ta = textareaRef.current;
    if (ta) { ta.style.height = 'auto'; ta.focus(); }
  }, [text, selectedCatId, onCommit]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleCommit();
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      setPickerOpen(o => !o);
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
            onClick={() => setPickerOpen(o => !o)}
            style={selectedCat ? { color: selectedCat.color, borderColor: selectedCat.color + '55' } : undefined}
          >
            {catLabel}
          </button>

          {pickerOpen && (
            <div className="capture-bar__picker">
              <button
                className="capture-bar__picker-item"
                style={{ color: '#666' }}
                onClick={() => selectCategory(null)}
              >
                → buffer
              </button>
              {categories.map(cat => (
                <button
                  key={cat.id}
                  className="capture-bar__picker-item"
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

        <span className="capture-bar__hint">↵ commit · tab for category</span>
      </div>
    </div>
  );
}
