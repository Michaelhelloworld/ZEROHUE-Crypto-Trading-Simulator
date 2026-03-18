import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { BRAND_SUBTITLE } from '../../../constants/branding';
import Sidebar from '../Sidebar';
import * as portfolioManagerModule from '../../../hooks/usePortfolioManager';

vi.mock('../../common/ZeroHueLogo', () => ({
  default: () => <div>Logo</div>,
}));

const mockPortfolioManager = (
  overrides: Partial<ReturnType<typeof portfolioManagerModule.usePortfolioManager>> = {}
) =>
  vi.spyOn(portfolioManagerModule, 'usePortfolioManager').mockReturnValue({
    totalEquity: 42000,
    totalPnL: 2000,
    pnlPercentage: 5,
    handleResetAccount: vi.fn(),
    isScoreDataComplete: true,
    ...overrides,
  } as unknown as ReturnType<typeof portfolioManagerModule.usePortfolioManager>);

describe('Sidebar', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('shows a price warning when total equity is using incomplete price data', () => {
    mockPortfolioManager({
      isScoreDataComplete: false,
    });

    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>
    );

    expect(screen.getByText(BRAND_SUBTITLE)).toBeInTheDocument();
    expect(screen.getByText(/Price data incomplete/i)).toBeInTheDocument();
  });

  it('keeps navigation links accessible after collapsing the sidebar', () => {
    mockPortfolioManager();

    render(
      <MemoryRouter initialEntries={['/markets']}>
        <Sidebar />
      </MemoryRouter>
    );

    const toggleButton = screen.getByRole('button', { name: /collapse sidebar/i });
    expect(toggleButton).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(toggleButton);

    expect(screen.getByRole('button', { name: /expand sidebar/i })).toHaveAttribute(
      'aria-expanded',
      'false'
    );

    for (const label of ['Markets', 'Portfolio', 'Orders', 'History', 'FAQ', 'About']) {
      expect(screen.getByRole('link', { name: label })).toBeInTheDocument();
    }
  });
});
