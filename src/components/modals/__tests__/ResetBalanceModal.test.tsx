import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import toast from 'react-hot-toast';
import ResetBalanceModal from '../ResetBalanceModal';

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('../../../hooks/useHaptic', () => ({
  useHaptic: () => ({ trigger: vi.fn() }),
}));

describe('ResetBalanceModal', () => {
  it('rejects decimal custom capital input before confirmation', () => {
    render(<ResetBalanceModal isOpen onClose={vi.fn()} onConfirm={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /or enter custom amount/i }));

    const input = screen.getByRole('spinbutton') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '123.45' } });

    expect(input.value).toBe('');
    expect(screen.queryByText(/Are you sure\?/i)).not.toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('shows whole-dollar formatting for custom reset confirmations', () => {
    render(<ResetBalanceModal isOpen onClose={vi.fn()} onConfirm={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /or enter custom amount/i }));

    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '50000' } });
    fireEvent.submit(input.closest('form') as HTMLFormElement);

    expect(screen.getByText(/\$50,000/)).toBeInTheDocument();
    expect(screen.queryByText(/\$50,000\.00/)).not.toBeInTheDocument();
  });
});
