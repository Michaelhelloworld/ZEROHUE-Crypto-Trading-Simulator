import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ObfuscatedEmail from '../ObfuscatedEmail';

describe('ObfuscatedEmail', () => {
  it('renders a labeled mailto link on the first render', () => {
    render(
      <ObfuscatedEmail
        user="support"
        domain="zerohue.org"
        label="Contact Support"
        className="support-link"
      />
    );

    expect(screen.getByRole('link', { name: 'Contact Support' })).toHaveAttribute(
      'href',
      'mailto:support@zerohue.org'
    );
  });

  it('keeps the fallback obfuscated text inside a clickable anchor', () => {
    render(<ObfuscatedEmail user="support" domain="zerohue.org" />);

    expect(screen.getByRole('link', { name: 'Email support' })).toHaveAttribute(
      'href',
      'mailto:support@zerohue.org'
    );
  });
});
