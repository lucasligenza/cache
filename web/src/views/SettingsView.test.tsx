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
  it('tells guests they lose access on sign-out (not that notes are cleared)', () => {
    render(<SettingsView {...props({ isGuest: true })} />);
    expect(screen.getByText(/sign out and you lose access to these notes/i)).toBeInTheDocument();
    expect(screen.queryByText(/clears these notes/i)).not.toBeInTheDocument();
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
