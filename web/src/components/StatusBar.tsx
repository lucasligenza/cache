import { ViewName } from '../types';
import './StatusBar.css';

interface Props {
  activeView: ViewName;
  unsortedCount: number;
  onTabClick: (view: ViewName) => void;
}

const TABS: { view: ViewName; label: string }[] = [
  { view: 'buffer', label: 'buffer' },
  { view: 'board',  label: 'board'  },
  { view: 'search', label: 'search' },
];

export function StatusBar({ activeView, unsortedCount, onTabClick }: Props) {
  return (
    <div className="status-bar">
      <span className="status-bar__brand">cache</span>

      {TABS.map(({ view, label }) => (
        <button
          key={view}
          className={`status-bar__tab${activeView === view ? ' status-bar__tab--active' : ''}`}
          onClick={() => onTabClick(view)}
        >
          {label}
          {view === 'buffer' && unsortedCount > 0 && (
            <span className="status-bar__badge">{unsortedCount}</span>
          )}
        </button>
      ))}

      <span className="status-bar__spacer" />
      <span className="status-bar__path">~/cache</span>
      <button
        className={`status-bar__settings-btn${activeView === 'settings' ? ' status-bar__settings-btn--active' : ''}`}
        onClick={() => onTabClick('settings')}
        title="settings"
      >
        ⚙
      </button>
    </div>
  );
}
