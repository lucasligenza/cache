import { useEffect, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import { MIN_PASSWORD_LENGTH } from '@cache/core';
import { DELETE_CONFIRM_WORD } from '../lib/deleteAccount';
import { LEGAL_PAGES } from '../lib/legalRoutes';
import type { PersistState } from '../lib/persist';
import './SettingsView.css';

interface Props {
  userEmail: string;
  isGuest?: boolean;
  /** Active notes; a guest logout erases these plus `archivedCount`. */
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
  /** Deletes notes, directories, push subscriptions, and the auth user. */
  onDeleteAccount: () => Promise<{ error: string | null }>;
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

export function SettingsView({ userEmail, isGuest = false, noteCount = 0, pendingCount = 0, storageState = null, initialUpgradeOpen = false, theme, accent, onThemeChange, onAccentChange, onSignOut, pushConfigured = true, pushStatus, onEnableNotifications, onDisableNotifications, onOpenArchive, archivedCount = 0, onExportJson, onExportMarkdown, onUpgradeAccount, onDeleteAccount }: Props) {
  const canUpgrade = isGuest && !!onUpgradeAccount;
  const [upgradeOpen, setUpgradeOpen] = useState(initialUpgradeOpen && canUpgrade);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [upgradeMsg, setUpgradeMsg] = useState<string | null>(null);

  const [confirmingLogout, setConfirmingLogout] = useState(false);
  const [exported, setExported] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const guardRef = useRef<HTMLDivElement>(null);
  const logoutRef = useRef<HTMLButtonElement>(null);
  const deleteBtnRef = useRef<HTMLButtonElement>(null);
  const deleteInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialUpgradeOpen && canUpgrade) {
      setConfirmingLogout(false);
      setConfirmingDelete(false);
      setUpgradeOpen(true);
    }
  }, [initialUpgradeOpen, canUpgrade]);

  useEffect(() => {
    if (upgradeOpen) emailRef.current?.focus();
  }, [upgradeOpen]);

  useEffect(() => {
    if (confirmingLogout) guardRef.current?.querySelector('button')?.focus();
  }, [confirmingLogout]);

  useEffect(() => {
    if (confirmingDelete) deleteInputRef.current?.focus();
  }, [confirmingDelete]);

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
    setConfirmingDelete(false);
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

  const startDelete = () => {
    setConfirmingLogout(false);
    setConfirmText('');
    setDeleteError(null);
    setConfirmingDelete(true);
  };

  const cancelDelete = () => {
    setConfirmingDelete(false);
    setConfirmText('');
    setDeleteError(null);
    setTimeout(() => deleteBtnRef.current?.focus(), 0);
  };

  const confirmDelete = async (e: FormEvent) => {
    e.preventDefault();
    if (confirmText !== DELETE_CONFIRM_WORD || deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const result = await onDeleteAccount();
      if (result.error) setDeleteError(result.error);
    } catch {
      setDeleteError('could not delete account');
    } finally {
      setDeleting(false);
    }
  };

  const onDeleteKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { e.stopPropagation(); cancelDelete(); }
  };

  const eraseTotal = noteCount + archivedCount;
  const eraseDetail = [
    archivedCount > 0 && `${archivedCount} in trash`,
    pendingCount > 0 && `${pendingCount} not yet synced`,
  ].filter(Boolean).join(', ');
  const eraseSummary = eraseTotal > 0
    ? `logout will erase ${plural(eraseTotal, 'note')}${eraseDetail ? ` (${eraseDetail})` : ''}`
    : 'logout ends this guest session';
  const deleteDetail = [
    eraseTotal > 0 && plural(eraseTotal, 'note'),
    pendingCount > 0 && `${pendingCount} not yet synced`,
  ].filter(Boolean).join(', ');
  const deleteSummary = deleteDetail
    ? `this permanently deletes your account, ${deleteDetail}, your directories, and reminders`
    : 'this permanently deletes your account, your directories, and reminders';
  const confirmMatches = confirmText === DELETE_CONFIRM_WORD;

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
            <>
              <div className="settings-row">
                <span className="settings-row__warn">
                  guest session — notes live only in this browser and can't be recovered after logout
                </span>
              </div>
              <div className="settings-row">
                <span className="settings-row__warn">
                  guest notes stay in the browser they were made in — create an account before adding the app to the home screen
                </span>
              </div>
            </>
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
          {canUpgrade && !confirmingLogout && (
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
          {!confirmingDelete ? (
            <div className="settings-row">
              <button ref={deleteBtnRef} className="settings-btn settings-btn--danger" onClick={startDelete}>
                $ delete account
              </button>
            </div>
          ) : (
            <form
              className="settings-danger"
              onSubmit={confirmDelete}
              onKeyDown={onDeleteKey}
              aria-labelledby="delete-account-msg"
            >
              <p id="delete-account-msg" className="settings-danger__msg">
                ! {deleteSummary}. type {DELETE_CONFIRM_WORD} to confirm — this can't be undone
              </p>
              <label className="settings-upgrade__label" htmlFor="delete-confirm">confirm</label>
              <input
                ref={deleteInputRef}
                id="delete-confirm"
                className="settings-upgrade__input"
                value={confirmText}
                onChange={e => setConfirmText(e.target.value)}
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                aria-describedby="delete-account-msg"
                aria-invalid={deleteError ? true : undefined}
              />
              {deleteError && <p className="settings-danger__error" role="alert">{deleteError}</p>}
              <div className="settings-guard__actions">
                <button
                  className="settings-btn settings-btn--danger"
                  type="submit"
                  disabled={!confirmMatches || deleting}
                >
                  {deleting ? 'deleting...' : '[delete forever]'}
                </button>
                <button className="settings-btn settings-btn--muted" type="button" onClick={cancelDelete}>
                  cancel
                </button>
              </div>
            </form>
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

        {/* Legal */}
        <section className="settings-section">
          <div className="settings-section__label">legal</div>
          <div className="settings-row settings-row--inline">
            <a className="settings-legal" href={LEGAL_PAGES[0]}>privacy</a>
            <a className="settings-legal" href={LEGAL_PAGES[1]}>terms</a>
            <span className="settings-row__dim">draft</span>
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
