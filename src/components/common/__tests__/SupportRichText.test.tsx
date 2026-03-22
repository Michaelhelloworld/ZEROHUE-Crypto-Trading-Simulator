import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SUPPORT_CONTACT_TOKEN } from '../../../content/publicContent';
import SupportRichText from '../SupportRichText';

describe('SupportRichText', () => {
  it('replaces the support token with a mailto link without exposing the raw token', () => {
    render(
      <p>
        <SupportRichText text={`Reach us through ${SUPPORT_CONTACT_TOKEN} today.`} />
      </p>
    );

    expect(screen.getByRole('link', { name: 'our official support email' })).toHaveAttribute(
      'href',
      'mailto:support@zerohue.org'
    );
    expect(screen.queryByText(SUPPORT_CONTACT_TOKEN)).not.toBeInTheDocument();
  });
});
