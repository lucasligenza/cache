import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsView } from './SettingsView';

function props(overrides: Partial<Parameters<typeof SettingsView>[0]> = {}) {
  return {
    userEmail: 'guest',
    theme: 'dark' as const,
    accent: 'green',
    onThemeChange: vi.fn(),
    onAccentChange: vi.fn(),
    onSignOut: vi.fn(),
    pushStatus: 'unsubscribed' as const,
    onEnableNotifications: vi.fn(),
    onDisableNotifications: vi.fn(),
    onOpenArchive: vi.fn(),
    onExportJson: vi.fn(),
    onExportMarkdown: vi.fn(),
    ...overrides,
  };
}

describe('SettingsView', () => {
  it('warns guests their notes cannot be recovered after logout', () => {
    render(<SettingsView {...props({ isGuest: true })} />);
    expect(screen.getByText(/can't be recovered after logout/i)).toBeInTheDocument();
  });

  it('logs a real account out in one click', async () => {
    const user = userEvent.setup();
    const onSignOut = vi.fn();
    render(<SettingsView {...props({ userEmail: 'a@b.com', onSignOut })} />);
    await user.click(screen.getByRole('button', { name: '$ logout' }));
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });

  describe('guest logout guard', () => {
    const guestProps = (overrides = {}) =>
      props({ isGuest: true, noteCount: 12, pendingCount: 2, onUpgradeAccount: vi.fn(), ...overrides });

    it('asks before erasing, with the note count', async () => {
      const user = userEvent.setup();
      const onSignOut = vi.fn();
      render(<SettingsView {...guestProps({ onSignOut })} />);

      await user.click(screen.getByRole('button', { name: '$ logout' }));

      expect(onSignOut).not.toHaveBeenCalled();
      expect(screen.getByText(/logout will erase 12 notes \(2 not yet synced\)/)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /\$ create account/ })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: '[create account first]' })).toHaveFocus();
    });

    it('erases and logs out on the second step', async () => {
      const user = userEvent.setup();
      const onSignOut = vi.fn().mockResolvedValue(undefined);
      render(<SettingsView {...guestProps({ onSignOut })} />);
      await user.click(screen.getByRole('button', { name: '$ logout' }));
      await user.click(screen.getByRole('button', { name: '[erase & logout]' }));
      expect(onSignOut).toHaveBeenCalledTimes(1);
    });

    it('offers export without leaving the guard', async () => {
      const user = userEvent.setup();
      const onExportJson = vi.fn();
      render(<SettingsView {...guestProps({ onExportJson })} />);
      await user.click(screen.getByRole('button', { name: '$ logout' }));
      await user.click(screen.getByRole('button', { name: '[export json]' }));
      expect(onExportJson).toHaveBeenCalled();
      expect(screen.getByRole('button', { name: '[exported ✓]' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '[erase & logout]' })).toBeInTheDocument();
    });

    it('jumps to the create-account form', async () => {
      const user = userEvent.setup();
      render(<SettingsView {...guestProps()} />);
      await user.click(screen.getByRole('button', { name: '$ logout' }));
      await user.click(screen.getByRole('button', { name: '[create account first]' }));
      expect(screen.queryByRole('button', { name: '[erase & logout]' })).not.toBeInTheDocument();
      expect(screen.getByLabelText('email')).toHaveFocus();
    });

    it('cancels with Escape and returns focus to logout', async () => {
      const user = userEvent.setup();
      render(<SettingsView {...guestProps()} />);
      await user.click(screen.getByRole('button', { name: '$ logout' }));
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('button', { name: '[erase & logout]' })).not.toBeInTheDocument();
      await vi.waitFor(() => expect(screen.getByRole('button', { name: '$ logout' })).toHaveFocus());
    });

    it('counts trashed notes in what gets erased', async () => {
      const user = userEvent.setup();
      render(<SettingsView {...guestProps({ noteCount: 14, archivedCount: 2, pendingCount: 0 })} />);
      await user.click(screen.getByRole('button', { name: '$ logout' }));
      expect(screen.getByText(/logout will erase 16 notes \(2 in trash\)/)).toBeInTheDocument();
    });

    it('still confirms for an empty guest session', async () => {
      const user = userEvent.setup();
      render(<SettingsView {...guestProps({ noteCount: 0, pendingCount: 0 })} />);
      await user.click(screen.getByRole('button', { name: '$ logout' }));
      expect(screen.getByText(/logout ends this guest session/)).toBeInTheDocument();
    });
  });

  it('labels the guest-upgrade inputs', async () => {
    const user = userEvent.setup();
    render(<SettingsView {...props({ isGuest: true, onUpgradeAccount: vi.fn() })} />);
    await user.click(screen.getByRole('button', { name: /create account/i }));
    expect(screen.getByLabelText('email')).toHaveAttribute('type', 'email');
    expect(screen.getByLabelText('password')).toHaveAttribute('type', 'password');
  });

  it('opens the upgrade form when arriving from a nudge', () => {
    render(<SettingsView {...props({ isGuest: true, onUpgradeAccount: vi.fn(), initialUpgradeOpen: true })} />);
    expect(screen.getByLabelText('email')).toBeInTheDocument();
  });

  it('shows whether guest storage is persistent', () => {
    const { rerender } = render(<SettingsView {...props({ isGuest: true, storageState: 'persistent' })} />);
    expect(screen.getByText('persistent')).toBeInTheDocument();
    rerender(<SettingsView {...props({ isGuest: true, storageState: 'best-effort' })} />);
    expect(screen.getByText(/browser may clear it/)).toBeInTheDocument();
  });

  it('hides notifications when push is not configured', () => {
    const { rerender } = render(<SettingsView {...props()} />);
    expect(screen.getByText('notifications')).toBeInTheDocument();
    rerender(<SettingsView {...props({ pushConfigured: false })} />);
    expect(screen.queryByText('notifications')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /enable notifications/i })).not.toBeInTheDocument();
  });

  it('shows the confirm-your-email message when an upgrade is pending', async () => {
    const user = userEvent.setup();
    const onUpgradeAccount = vi.fn().mockResolvedValue({
      error: null,
      successMessage: 'account saved — check your email to confirm your new address',
    });
    render(<SettingsView {...props({ isGuest: true, onUpgradeAccount })} />);

    await user.click(screen.getByRole('button', { name: /create account/i }));
    await user.type(screen.getByPlaceholderText('email'), 'real@b.com');
    await user.type(screen.getByPlaceholderText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /^create$/i }));

    expect(onUpgradeAccount).toHaveBeenCalledWith('real@b.com', 'password123');
    expect(await screen.findByText(/check your email to confirm/i)).toBeInTheDocument();
  });
});
