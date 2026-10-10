import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { NewPasswordScreen } from './NewPasswordScreen';

function fill(password: string, confirm: string) {
  fireEvent.change(screen.getByLabelText('new password'), { target: { value: password } });
  fireEvent.change(screen.getByLabelText('confirm password'), { target: { value: confirm } });
  fireEvent.click(screen.getByRole('button', { name: /update password/i }));
}

describe('NewPasswordScreen', () => {
  it('names the account being reset', () => {
    render(<NewPasswordScreen email="a@b.com" onSubmit={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText('set a new password for a@b.com')).toBeInTheDocument();
  });

  it('rejects a short password before submitting', () => {
    const onSubmit = vi.fn();
    render(<NewPasswordScreen onSubmit={onSubmit} onCancel={vi.fn()} />);
    fill('short', 'short');
    expect(screen.getByRole('alert')).toHaveTextContent('at least 8 characters');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('rejects mismatched passwords', () => {
    const onSubmit = vi.fn();
    render(<NewPasswordScreen onSubmit={onSubmit} onCancel={vi.fn()} />);
    fill('longenough1', 'longenough2');
    expect(screen.getByRole('alert')).toHaveTextContent("passwords don't match");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits a valid password and shows server errors', async () => {
    const onSubmit = vi.fn().mockResolvedValue({ error: 'new password must differ from the old one' });
    render(<NewPasswordScreen onSubmit={onSubmit} onCancel={vi.fn()} />);
    fill('longenough1', 'longenough1');
    expect(onSubmit).toHaveBeenCalledWith('longenough1');
    expect(await screen.findByRole('alert')).toHaveTextContent('must differ');
  });

  it('can cancel out of recovery', () => {
    const onCancel = vi.fn();
    render(<NewPasswordScreen onSubmit={vi.fn()} onCancel={onCancel} />);
    fireEvent.click(screen.getByText('[cancel & sign out]'));
    expect(onCancel).toHaveBeenCalled();
  });
});
