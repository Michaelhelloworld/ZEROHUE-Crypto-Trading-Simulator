import React from 'react';
import { formatPrice } from '../../utils/format';

interface PriceDisplayProps {
  price: number;
  className?: string; // Allow styling override
}

const PriceDisplay: React.FC<PriceDisplayProps> = ({ price, className = '' }) => {
  // Only apply special formatting for very small numbers (e.g. < 0.001 and > 0)
  if (price > 0 && price < 0.001) {
    // Convert to string with enough precision to catch significant digits
    // Usually 20 is safe for standard floats
    const str = price.toFixed(20);

    // Regex: Match 0. (sequence of zeros) (first non-zero + subsequent chars)
    const match = str.match(/^0\.(0+)([^0]\d*)$/);

    if (match) {
      const leadingZerosCount = match[1].length;

      // Only use subscript if we have enough zeros (e.g. > 2)
      // User example showed 5 zeros. Usually 3-4+ is where it helps.
      // Let's stick to standard practice: if zeros >= 3, use subscript.
      // Otherwise regular display.

      if (leadingZerosCount >= 3) {
        const significantDigits = match[2].slice(0, 4); // Keep 4 significant digits

        return (
          <span
            className={`inline-flex items-baseline font-mono ${className}`}
            title={`$${price.toFixed(10)}`}
          >
            <span className="sr-only">${price.toFixed(10)}</span>
            <span aria-hidden="true">$0.0</span>
            <sub aria-hidden="true" className="text-[0.6em] mx-[1px] opacity-80">
              {leadingZerosCount}
            </sub>
            <span aria-hidden="true">{significantDigits}</span>
          </span>
        );
      }
    }
  }

  // Fallback to standard string formatting
  return (
    <span className={`font-mono ${className}`} title={`$${price.toLocaleString()}`}>
      ${formatPrice(price)}
    </span>
  );
};

export default React.memo(PriceDisplay);
