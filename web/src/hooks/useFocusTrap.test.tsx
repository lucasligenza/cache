import { describe, it, expect } from 'vitest';
import { useRef } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { useFocusTrap } from './useFocusTrap';

function Trap({ active }: { active: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, active);
  return (
    <div ref={ref} data-testid="trap">
      <button>first</button>
      <button>second</button>
      <button>third</button>
    </div>
  );
}

function Wrapper({ active }: { active: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, active);
  return (
    <>
      <button>outside</button>
      <div ref={ref}>
        <button>inner</button>
      </div>
    </>
  );
}

describe('useFocusTrap', () => {
  it('focuses the first focusable element when activated', () => {
    render(<Trap active />);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'first' }));
  });

  it('wraps Tab from the last element back to the first', () => {
    render(<Trap active />);
    const container = screen.getByTestId('trap');
    screen.getByRole('button', { name: 'third' }).focus();
    fireEvent.keyDown(container, { key: 'Tab' });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'first' }));
  });

  it('wraps Shift+Tab from the first element to the last', () => {
    render(<Trap active />);
    const container = screen.getByTestId('trap');
    screen.getByRole('button', { name: 'first' }).focus();
    fireEvent.keyDown(container, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'third' }));
  });

  it('does nothing when inactive', () => {
    render(<Trap active={false} />);
    // No element grabbed focus (jsdom defaults focus to <body>).
    expect(document.activeElement).toBe(document.body);
  });

  it('restores focus to the previously-focused element on deactivate', () => {
    const { rerender } = render(<Wrapper active={false} />);
    const outside = screen.getByRole('button', { name: 'outside' });
    outside.focus();
    expect(document.activeElement).toBe(outside);

    rerender(<Wrapper active />); // traps: focus moves inside
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'inner' }));

    rerender(<Wrapper active={false} />); // cleanup restores prior focus
    expect(document.activeElement).toBe(outside);
  });
});
