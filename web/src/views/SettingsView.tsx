import './SettingsView.css';

interface Props {
  userEmail: string;
  isGuest?: boolean;
  theme: 'dark' | 'light';
  accent: string;
  onThemeChange: (theme: 'dark' | 'light') => void;
  onAccentChange: (accent: string) => void;
  onSignOut: () => void;
  pushStatus: 'unsupported' | 'denied' | 'subscribed' | 'unsubscribed';
  onEnableNotifications: () => void;
  onDisableNotifications: () => void;
  onOpenArchive: () => void;
  archivedCount?: number;
}

const ACCENT_OPTIONS: { key: string; color: string }[] = [
  { key: 'green',  color: '#39FF14' },
  { key: 'amber',  color: '#F5A623' },
  { key: 'blue',   color: '#4FC3F7' },
  { key: 'purple', color: '#CE93D8' },
  { key: 'red',    color: '#FF4444' },
  { key: 'white',  color: '#E0E0E0' },
];

export function SettingsView({ userEmail, isGuest = false, theme, accent, onThemeChange, onAccentChange, onSignOut, pushStatus, onEnableNotifications, onDisableNotifications, onOpenArchive, archivedCount = 0 }: Props) {
  return (
    <div className="settings-view">
      <div className="settings-view__header">
        <span className="settings-view__prompt">~/cache $ </span>
        <span className="settings-view__cmd">settings</span>
      </div>

      <div className="settings-view__body">

        {/* Account */}
        <section className="settings-section">
          <div className="settings-section__label">account</div>
          <div className="settings-row">
            <span className="settings-row__key">user:</span>
            <span className="settings-row__value">{userEmail}</span>
          </div>
          {isGuest && (
            <div className="settings-row">
              <span className="settings-row__dim">guest session — sign out clears these notes</span>
            </div>
          )}
          <div className="settings-row">
            <button className="settings-btn" onClick={onSignOut}>
              $ logout
            </button>
          </div>
        </section>

        {/* Theme */}
        <section className="settings-section">
          <div className="settings-section__label">theme</div>
          <div className="settings-row settings-row--inline">
            <button
              className={`settings-toggle${theme === 'dark' ? ' settings-toggle--active' : ''}`}
              onClick={() => onThemeChange('dark')}
            >
              {theme === 'dark' ? '[dark]' : 'dark'}
            </button>
            <span className="settings-toggle-sep">/</span>
            <button
              className={`settings-toggle${theme === 'light' ? ' settings-toggle--active' : ''}`}
              onClick={() => onThemeChange('light')}
            >
              {theme === 'light' ? '[light]' : 'light'}
            </button>
          </div>
        </section>

        {/* Storage */}
        <section className="settings-section">
          <div className="settings-section__label">storage</div>
          <div className="settings-row">
            <button className="settings-btn" onClick={onOpenArchive}>
              $ ls ~/.trash{archivedCount > 0 ? ` (${archivedCount})` : ''}
            </button>
          </div>
        </section>

        {/* Notifications */}
        <section className="settings-section">
          <div className="settings-section__label">notifications</div>
          {pushStatus === 'unsupported' && (
            <div className="settings-row">
              <span className="settings-row__dim">not supported in this browser</span>
            </div>
          )}
          {pushStatus === 'denied' && (
            <div className="settings-row">
              <span className="settings-row__dim" style={{ color: 'var(--red)' }}>
                blocked — enable in browser settings
              </span>
            </div>
          )}
          {pushStatus === 'unsubscribed' && (
            <div className="settings-row">
              <button className="settings-btn" onClick={onEnableNotifications}>
                $ enable notifications
              </button>
            </div>
          )}
          {pushStatus === 'subscribed' && (
            <div className="settings-row settings-row--inline">
              <span className="settings-row__value" style={{ color: 'var(--accent)' }}>● active</span>
              <button className="settings-btn settings-btn--muted" onClick={onDisableNotifications} style={{ marginLeft: '16px' }}>
                $ disable
              </button>
            </div>
          )}
        </section>

        {/* Accent color */}
        <section className="settings-section">
          <div className="settings-section__label">accent</div>
          <div className="settings-row settings-row--inline">
            {ACCENT_OPTIONS.map(({ key, color }) => (
              <button
                key={key}
                className={`settings-swatch${accent === key ? ' settings-swatch--active' : ''}`}
                style={{ '--swatch-color': color } as React.CSSProperties}
                onClick={() => onAccentChange(key)}
                title={key}
                aria-label={`accent color ${key}`}
              />
            ))}
          </div>
        </section>

        {/* About */}
        <section className="settings-section">
          <div className="settings-section__label">about</div>
          <div className="settings-row">
            <span className="settings-row__value">cache v0.1.0</span>
          </div>
          <div className="settings-row">
            <span className="settings-row__dim">~/cache</span>
          </div>
        </section>

      </div>
    </div>
  );
}
