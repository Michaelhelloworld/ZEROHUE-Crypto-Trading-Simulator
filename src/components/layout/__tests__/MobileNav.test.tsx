import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import MobileNav from '../MobileNav';

const trigger = vi.fn();

vi.mock('../../../hooks/useHaptic', () => ({
  useHaptic: () => ({
    trigger,
  }),
}));

vi.mock('framer-motion', () => ({
  motion: new Proxy(
    {},
    {
      get:
        (_target, tag: string) =>
        ({
          children,
          layoutId: _layoutId,
          transition: _transition,
          ...props
        }: {
          children?: React.ReactNode;
          layoutId?: string;
          transition?: unknown;
        }) =>
          React.createElement(tag, props, children),
    }
  ),
}));

describe('MobileNav', () => {
  it('marks the active destination and triggers haptics when a tab is pressed', () => {
    render(
      <MemoryRouter initialEntries={['/portfolio']}>
        <MobileNav />
      </MemoryRouter>
    );

    const navigation = screen.getByRole('navigation', { name: /primary mobile navigation/i });
    const activeLink = screen.getByRole('link', { name: /portfolio/i });
    const marketsLink = screen.getByRole('link', { name: /market/i });

    expect(navigation).toBeInTheDocument();
    expect(activeLink).toHaveAttribute('aria-current', 'page');

    fireEvent.click(marketsLink);

    expect(trigger).toHaveBeenCalledWith('light');
  });

  it('keeps the current tab active when the URL has a trailing slash', () => {
    render(
      <MemoryRouter initialEntries={['/portfolio/']}>
        <MobileNav />
      </MemoryRouter>
    );

    expect(screen.getByRole('link', { name: /portfolio/i })).toHaveAttribute(
      'aria-current',
      'page'
    );
  });
});
