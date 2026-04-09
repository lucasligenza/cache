import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { BottomNav } from './BottomNav';

describe('BottomNav', () => {
  it('renders all four tab labels', () => {
    render(<BottomNav activeView="buffer" unsortedCount={0} onTabClick={vi.fn()} />);
    expect(screen.getByText('buffer')).toBeInTheDocument();
    expect(screen.getByText('board')).toBeInTheDocument();
    expect(screen.getByText('search')).toBeInTheDocument();
    expect(screen.getByText('settings')).toBeInTheDocument();
  });

  it('applies active class to the current tab only', () => {
    render(<BottomNav activeView="board" unsortedCount={0} onTabClick={vi.fn()} />);
    const buttons = screen.getAllByRole('button');
    const boardBtn = buttons.find(b => b.textContent?.includes('board'));
    const bufferBtn = buttons.find(b => b.textContent?.includes('buffer'));
    expect(boardBtn).toHaveClass('bottom-nav__tab--active');
    expect(bufferBtn).not.toHaveClass('bottom-nav__tab--active');
  });

  it('calls onTabClick with view name when a tab is clicked', () => {
    const onTabClick = vi.fn();
    render(<BottomNav activeView="buffer" unsortedCount={0} onTabClick={onTabClick} />);
    const buttons = screen.getAllByRole('button');
    const searchBtn = buttons.find(b => b.textContent?.includes('search'))!;
    fireEvent.click(searchBtn);
    expect(onTabClick).toHaveBeenCalledWith('search');
  });

  it('shows unsorted count badge on buffer tab when count > 0', () => {
    render(<BottomNav activeView="buffer" unsortedCount={5} onTabClick={vi.fn()} />);
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('does not render badge when unsortedCount is 0', () => {
    render(<BottomNav activeView="buffer" unsortedCount={0} onTabClick={vi.fn()} />);
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });
});
