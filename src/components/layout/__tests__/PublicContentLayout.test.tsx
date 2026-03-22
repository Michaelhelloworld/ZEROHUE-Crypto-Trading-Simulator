import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router';
import PublicContentLayout from '../PublicContentLayout';

vi.mock('../../common/ZeroHueLogo', () => ({
  default: () => <div>Logo</div>,
}));

describe('PublicContentLayout', () => {
  it('shows the support email link in the public content footer connect section', () => {
    render(
      <MemoryRouter initialEntries={['/about']}>
        <PublicContentLayout>
          <div>About page body</div>
        </PublicContentLayout>
      </MemoryRouter>
    );

    expect(screen.getByText('About page body')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Email' })).toHaveAttribute(
      'href',
      'mailto:support@zerohue.org'
    );
  });
});
