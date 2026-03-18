import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import StatCard from '../StatCard';

vi.mock('framer-motion', () => ({
  motion: {
    div: ({
      children,
      whileHover: _whileHover,
      whileTap: _whileTap,
      transition: _transition,
      ...props
    }: React.HTMLAttributes<HTMLDivElement> & {
      whileHover?: unknown;
      whileTap?: unknown;
      transition?: unknown;
    }) => <div {...props}>{children}</div>,
  },
}));

describe('StatCard', () => {
  it('renders helper text when provided', () => {
    render(
      <StatCard
        label="Total Equity"
        value={42000}
        prefix="$"
        helperText="Price data incomplete"
        helperTone="warning"
      />
    );

    expect(screen.getByText('Total Equity')).toBeInTheDocument();
    expect(screen.getByText('Price data incomplete')).toBeInTheDocument();
  });
});
