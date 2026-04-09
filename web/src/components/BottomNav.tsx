import type { ViewName } from '../types';
import './BottomNav.css';

interface Props {
  activeView: ViewName;
  unsortedCount: number;
  onTabClick: (view: ViewName) => void;
}

const TABS: { view: ViewName; icon: string; label: string }[] = [
  { view: 'buffer',   icon: '⟩_', label: 'buffer'   },
  { view: 'board',    icon: '⊞',  label: 'board'    },
  { view: 'search',   icon: '⌕',  label: 'search'   },
  { view: 'settings', icon: '⚙',  label: 'settings' },
];

export function BottomNav({ activeView, unsortedCount, onTabClick }: Props) {
  return (
    <nav className="bottom-nav">
      {TABS.map(({ view, icon, label }) => (
        <button
          key={view}
          className={`bottom-nav__tab${activeView === view ? ' bottom-nav__tab--active' : ''}`}
          onClick={() => onTabClick(view)}
        >
          <span className="bottom-nav__icon">
            {icon}
            {view === 'buffer' && unsortedCount > 0 && (
              <span className="bottom-nav__badge">{unsortedCount}</span>
            )}
          </span>
          <span className="bottom-nav__label">{label}</span>
        </button>
      ))}
    </nav>
  );
}
