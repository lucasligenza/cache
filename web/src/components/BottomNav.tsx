import { useEffect, useRef, useState } from 'react';
import type { ViewName } from '../types';
import './BottomNav.css';

interface Props {
  activeView: ViewName;
  unsortedCount: number;
  reviewCount: number;
  onTabClick: (view: ViewName) => void;
}

const TABS: { view: ViewName; icon: string; label: string }[] = [
  { view: 'buffer', icon: '⟩_', label: 'buffer' },
  { view: 'board',  icon: '⊞',  label: 'board'  },
  { view: 'search', icon: '⌕',  label: 'search' },
  { view: 'review', icon: '↻',  label: 'review' },
];

export function BottomNav({ activeView, unsortedCount, reviewCount, onTabClick }: Props) {
  const prev = useRef(unsortedCount);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (unsortedCount > prev.current) {
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 400);
      prev.current = unsortedCount;
      return () => clearTimeout(t);
    }
    prev.current = unsortedCount;
  }, [unsortedCount]);

  const badgeFor = (view: ViewName): { count: number; mod: string; srText: string } | null => {
    if (view === 'buffer' && unsortedCount > 0) return { count: unsortedCount, mod: pulse ? ' bottom-nav__badge--pulse' : '', srText: `${unsortedCount} unsorted` };
    if (view === 'review' && reviewCount > 0) return { count: reviewCount, mod: ' bottom-nav__badge--review', srText: `${reviewCount} to review` };
    return null;
  };

  return (
    <nav className="bottom-nav" aria-label="views">
      {TABS.map(({ view, icon, label }) => {
        const badge = badgeFor(view);
        return (
          <button
            key={view}
            className={`bottom-nav__tab${activeView === view ? ' bottom-nav__tab--active' : ''}`}
            aria-current={activeView === view ? 'page' : undefined}
            data-view={view}
            onClick={() => onTabClick(view)}
          >
            <span className="bottom-nav__icon" aria-hidden="true">
              {icon}
              {badge && <span className={`bottom-nav__badge${badge.mod}`}>{badge.count}</span>}
            </span>
            <span className="bottom-nav__label">
              {label}
              {badge && <span className="visually-hidden">, {badge.srText}</span>}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
