import { useEffect, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import { MIN_PASSWORD_LENGTH } from '@cache/core';
import type { PersistState } from '../lib/persist';
import './SettingsView.css';

interface Props {
  userEmail: string;
  isGuest?: boolean;
  /** Active + trashed notes — what a guest logout erases. */
  noteCount?: number;
  /** Captures still waiting to sync. */
  pendingCount?: number;
  /** Guest-only: whether the browser granted persistent storage. */
  storageState?: PersistState | null;
  /** Open the create-account form (arriving from an upgrade nudge). */
  initialUpgradeOpen?: boolean;
  theme: 'dark' | 'light';
  accent: string;
  onThemeChange: (theme: 'dark' | 'light') => void;
  onAccentChange: (accent: string) => void;
  onSignOut: () => void | Promise<unknown>;
  /** False when this build has no VAPID key — hide notifications entirely. */
  pushConfigured?: boolean;
  pushStatus: 'unsupported' | 'denied' | 'subscribed' | 'unsubscribed';
  onEnableNotifications: () => void;
  onDisableNotifications: () => void;
  onOpenArchive: () => void;
  archivedCount?: number;
  onExportJson: () => void;
  onExportMarkdown: () => void;
  onUpgradeAccount?: (email: string, password: string) => Promise<{ error: string | null; successMessage?: string }>;
}

const ACCENT_OPTIONS: { key: string; color: string }[] = [
  { key: 'green',  color: '#39FF14' },
  { key: 'amber',  color: '#F5A623' },
  { key: 'blue',   color: '#4FC3F7' },
  { key: 'purple', color: '#CE93D8' },
  { key: 'red',    color: '#FF4444' },
  { key: 'white',  color: '#E0E0E0' },
];

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function SettingsView({ userEmail, isGuest = false, noteCount = 0, pendingCount = 0, storageState = null, initialUpgradeOpen = false, theme, accent, onThemeChange, onAccentChange, onSignOut, pushConfigured = true, pushStatus, onEnableNotifications, onDisableNotifications, onOpenArchive, archivedCount = 0, onExportJson, onExportMarkdown, onUpgradeAccount }: Props) {
  const canUpgrade = isGuest && !!onUpgradeAccount;
  const [upgradeOpen, setUpgradeOpen] = useState(initialUpgradeOpen && canUpgrade);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [upgradeMsg, setUpgradeMsg] = useState<string | null>(null);

  const [confirmingLogout, setConfirmingLogout] = useState(false);
  const [exported, setExported] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const guardRef = useRef<HTMLDivElement>(null);
  const logoutRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (initialUpgradeOpen && canUpgrade) {
      setConfirmingLogout(false);
      setUpgradeOpen(true);
    }
  }, [initialUpgradeOpen, canUpgrade]);

  useEffect(() => {
    if (upgradeOpen) emailRef.current?.focus();
  }, [upgradeOpen]);

  useEffect(() => {
    if (confirmingLogout) guardRef.current?.querySelector('button')?.focus();
  }, [confirmingLogout]);

  const handleUpgrade = async (e: FormEvent) => {
    e.preventDefault();
    if (!onUpgradeAccount) return;
    if (password.length < MIN_PASSWORD_LENGTH) {
      setUpgradeMsg(`password must be at least ${MIN_PASSWORD_LENGTH} characters`);
      return;
    }
    setSubmitting(true);
    const { error, successMessage } = await onUpgradeAccount(email, password);
    setSubmitting(false);
    setUpgradeMsg(error ?? successMessage ?? 'account created — your notes are saved');
  };

  const handleLogoutClick = () => {
    if (isGuest) setConfirmingLogout(true);
    else void onSignOut();
  };

  const cancelLogout = () => {
    setConfirmingLogout(false);
    setTimeout(() => logoutRef.current?.focus(), 0);
  };

  const createAccountFirst = () => {
    setConfirmingLogout(false);
    setUpgradeOpen(true);
  };

  const exportFromGuard = () => {
    onExportJson();
    setExported(true);
  };

  const eraseAndLogout = async () => {
    setSigningOut(true);
    try {
      await onSignOut();
    } finally {
      setSigningOut(false);
    }
  };

  const onGuardKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { e.stopPropagation(); cancelLogout(); }
  };

  const eraseSummary = noteCount > 0
    ? `logout will erase ${plural(noteCount, 'note')}${pendingCount > 0 ? ` (${pendingCount} not yet synced)` : ''}`
    : 'logout ends this guest session';

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
              <span className="settings-row__warn">
                guest session — notes live only in this browser and can't be recovered after logout
              </span>
            </div>
          )}
          {isGuest && storageState && storageState !== 'unsupported' && (
            <div className="settings-row">
              <span className="settings-row__key">storage:</span>
              {storageState === 'persistent' ? (
                <span className="settings-row__value settings-row__value--ok">persistent</span>
              ) : (
                <span className="settings-row__warn">best-effort — the browser may clear it</span>
              )}
            </div>
          )}
          {canUpgrade && (
            <div className="settings-upgrade">
              {!upgradeOpen ? (
                <button className="settings-btn settings-btn--accent" onClick={() => setUpgradeOpen(true)}>
                  $ create account (keep notes)
                </button>
              ) : (
                <form className="settings-upgrade__form" onSubmit={handleUpgrade} aria-label="create account">
                  <label className="settings-upgrade__label" htmlFor="upgrade-email">email</label>
                  <input
                    ref={emailRef}
                    id="upgrade-email"
                    className="settings-upgrade__input"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="email"
                    autoComplete="email"
                    required
                  />
                  <label className="settings-upgrade__label" htmlFor="upgrade-password">password</label>
                  <input
                    id="upgrade-password"
                    className="settings-upgrade__input"
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder={`password (${MIN_PASSWORD_LENGTH}+ chars)`}
                    autoComplete="new-password"
                    aria-describedby="upgrade-password-hint"
                    required
                  />
                  <span id="upgrade-password-hint" className="settings-row__dim">
                    {MIN_PASSWORD_LENGTH}+ chars · your notes stay put
                  </span>
                  <div className="settings-upgrade__actions">
                    <button className="settings-btn settings-btn--accent" type="submit" disabled={submitting}>
                      {submitting ? 'creating...' : 'create'}
                    </button>
                    <button className="settings-btn settings-btn--muted" type="button" onClick={() => setUpgradeOpen(false)}>
                      cancel
                    </button>
                  </div>
                  {upgradeMsg && <span className="settings-row__dim" role="status">{upgradeMsg}</span>}
                </form>
              )}
            </div>
          )}
          {!confirmingLogout ? (
            <div className="settings-row">
              <button ref={logoutRef} className="settings-btn" onClick={handleLogoutClick}>
                $ logout
              </button>
            </div>
          ) : (
            <div
              ref={guardRef}
              className="settings-guard"
              role="group"
              aria-labelledby="logout-guard-msg"
              onKeyDown={onGuardKey}
            >
              <p id="logout-guard-msg" className="settings-guard__msg">
                ! {eraseSummary} — a guest session can't be signed back into
              </p>
              <div className="settings-guard__actions">
                {canUpgrade && (
                  <button className="settings-btn settings-btn--accent" onClick={createAccountFirst}>
                    [create account first]
                  </button>
                )}
                <button className="settings-btn" onClick={exportFromGuard}>
                  {exported ? '[exported ✓]' : '[export json]'}
                </button>
                <button
                  className="settings-btn settings-btn--danger"
                  onClick={eraseAndLogout}
                  disabled={signingOut}
                >
                  {signingOut ? 'logging out...' : '[erase & logout]'}
                </button>
                <button className="settings-btn settings-btn--muted" onClick={cancelLogout}>
                  cancel
                </button>
              </div>
            </div>
          )}
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
        {pushConfigured && (
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
        )}

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

        {/* Data */}
        <section className="settings-section">
          <div className="settings-section__label">data</div>
          <div className="settings-row settings-row--inline">
            <button className="settings-btn" onClick={onExportJson}>$ export json</button>
            <button className="settings-btn settings-btn--muted" onClick={onExportMarkdown} style={{ marginLeft: '16px' }}>
              export md
            </button>
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
