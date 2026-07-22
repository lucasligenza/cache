import { useRef } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';
import './OnboardingOverlay.css';

interface Props {
  open: boolean;
  onDismiss: () => void;
}

const TIPS: { cmd: string; desc: string }[] = [
  { cmd: 'type + ↵', desc: 'cache a note into the buffer' },
  { cmd: '/work …', desc: 'file it straight into a directory' },
  { cmd: 'tab', desc: 'pick a category before you commit' },
  { cmd: 'board', desc: 'your notes, sorted into directories' },
  { cmd: 'review', desc: 'revisit overdue / stale / old notes' },
  { cmd: '⌘/ctrl k', desc: 'command palette · ? for all shortcuts' },
];

export function OnboardingOverlay({ open, onDismiss }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, open);

  if (!open) return null;
  return (
    <div className="onboarding-overlay" onKeyDown={e => { if (e.key === 'Escape') onDismiss(); }}>
      <div
        className="onboarding-panel"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="welcome to cache"
      >
        <div className="onboarding-panel__title">$ welcome to ~/cache</div>
        <div className="onboarding-panel__sub">a terminal for your notes — the gist:</div>
        <div className="onboarding-panel__list">
          {TIPS.map(t => (
            <div key={t.cmd} className="onboarding-panel__row">
              <kbd className="onboarding-panel__cmd">{t.cmd}</kbd>
              <span className="onboarding-panel__desc">{t.desc}</span>
            </div>
          ))}
        </div>
        <button className="onboarding-panel__go" onClick={onDismiss}>[ got it ]</button>
      </div>
    </div>
  );
}
