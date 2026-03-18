import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import CryptoIcon from '../CryptoIcon';

describe('CryptoIcon', () => {
  it('uses a solid white background layer for RENDER icons', () => {
    render(<CryptoIcon symbol="RENDER" size={50} />);

    const backgroundLayer = screen.getByTestId('crypto-icon-bg-RENDER');
    expect(backgroundLayer.className).toContain('bg-white');
    expect(backgroundLayer.className).toContain('opacity-100');

    const image = screen.getByAltText('RENDER');
    expect(image).toHaveStyle({ width: '40px', height: '40px' });
  });

  it('keeps the RENDER fallback icon on a white background', () => {
    render(<CryptoIcon symbol="RENDER" />);

    fireEvent.error(screen.getByAltText('RENDER'));

    const fallback = screen.getByText('R');
    expect(fallback.className).toContain('bg-[#FFFFFF]');
    expect(fallback.className).toContain('text-[#FF4D4F]');
  });
});
