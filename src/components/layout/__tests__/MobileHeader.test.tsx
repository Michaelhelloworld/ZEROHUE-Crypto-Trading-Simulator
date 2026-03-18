import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BRAND_SUBTITLE } from '../../../constants/branding';
import MobileHeader from '../MobileHeader';
import * as portfolioManagerModule from '../../../hooks/usePortfolioManager';

vi.mock('../../common/ZeroHueLogo', () => ({
  default: () => <div>Logo</div>,
}));

describe('MobileHeader', () => {
  it('shows a price warning when total equity is using incomplete price data', () => {
    vi.spyOn(portfolioManagerModule, 'usePortfolioManager').mockReturnValue({
      totalEquity: 42000,
      handleResetAccount: vi.fn(),
      isScoreDataComplete: false,
    } as unknown as ReturnType<typeof portfolioManagerModule.usePortfolioManager>);

    render(<MobileHeader />);

    expect(screen.getByText(BRAND_SUBTITLE)).toBeInTheDocument();
    expect(screen.getByText(/Price data incomplete/i)).toBeInTheDocument();
  });

  it('exposes a clear reset action on mobile and calls the reset handler', () => {
    const handleResetAccount = vi.fn();

    vi.spyOn(portfolioManagerModule, 'usePortfolioManager').mockReturnValue({
      totalEquity: 42000,
      handleResetAccount,
      isScoreDataComplete: true,
    } as unknown as ReturnType<typeof portfolioManagerModule.usePortfolioManager>);

    render(<MobileHeader />);

    const resetButton = screen.getByRole('button', { name: /reset simulated account/i });

    fireEvent.click(resetButton);

    expect(handleResetAccount).toHaveBeenCalledTimes(1);
  });
});
