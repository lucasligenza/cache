import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider, useToast } from './Toast';

function TestTrigger({ type, msg }: { type: 'error' | 'ok' | 'warn'; msg: string }) {
  const { showToast } = useToast();
  return <button onClick={() => showToast(type, msg)}>trigger</button>;
}

describe('Toast', () => {
  it('shows toast message when showToast is called', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <TestTrigger type="error" msg="something broke" />
      </ToastProvider>
    );
    await user.click(screen.getByText('trigger'));
    expect(screen.getByText('something broke')).toBeInTheDocument();
    expect(screen.getByText('error')).toBeInTheDocument();
  });

  it('dismisses toast on × click', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <TestTrigger type="ok" msg="all good" />
      </ToastProvider>
    );
    await user.click(screen.getByText('trigger'));
    expect(screen.getByText('all good')).toBeInTheDocument();
    await user.click(screen.getByText('×'));
    expect(screen.queryByText('all good')).not.toBeInTheDocument();
  });

  it('shows warn toast with correct label', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <TestTrigger type="warn" msg="missing key" />
      </ToastProvider>
    );
    await user.click(screen.getByText('trigger'));
    expect(screen.getByText('warn')).toBeInTheDocument();
    expect(screen.getByText('missing key')).toBeInTheDocument();
  });

  it('renders an action button and runs the action on click', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    function ActionTrigger() {
      const { showToast } = useToast();
      return (
        <button onClick={() => showToast('ok', 'note archived', { actionLabel: 'undo', onAction })}>
          trigger
        </button>
      );
    }
    render(
      <ToastProvider>
        <ActionTrigger />
      </ToastProvider>
    );
    await user.click(screen.getByText('trigger'));
    await user.click(screen.getByText('[undo]'));
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('note archived')).not.toBeInTheDocument();
  });
});
