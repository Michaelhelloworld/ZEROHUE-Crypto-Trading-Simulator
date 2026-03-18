import React, { useState } from 'react';

interface CryptoIconProps {
  symbol: string;
  size?: number;
  className?: string;
}

// Expanded Map of top cryptocurrencies to their CoinMarketCap IDs
const CMC_IDS: Record<string, number> = {
  // Top 10
  BTC: 1,
  ETH: 1027,
  USDT: 825,
  BNB: 1839,
  SOL: 5426,
  XRP: 52,
  USDC: 3408,
  ADA: 2010,
  AVAX: 5805,
  DOGE: 74,

  // Top 50 Common
  DOT: 6636,
  LINK: 1975,
  MATIC: 3890,
  TON: 11419,
  SHIB: 5994,
  DAI: 4943,
  LTC: 2,
  BCH: 1831,
  CRO: 3635,
  ZEC: 1437,
  LEO: 3964,
  UNI: 7083,
  ATOM: 3794,
  ETC: 1321,
  XLM: 512,
  XMR: 328,
  OKB: 3897,
  FIL: 2280,
  HBAR: 4642,
  APT: 21794,
  VET: 3077,
  NEAR: 6535,
  MKR: 1518,
  AAVE: 7278,
  ONDO: 21159,
  QNT: 3155,
  ALGO: 4030,
  STX: 4847,
  ICP: 8916,
  EOS: 1765,
  SAND: 6210,
  THETA: 3602,
  FTM: 3513,
  MANA: 1966,
  AXS: 6783,
  FLOW: 4558,
  EGLD: 6892,
  APE: 18876,
  XTZ: 2011,
  KCS: 2087,
  BSV: 3916,
  BTT: 3718,
  LUNC: 4172,
  PEPE: 24478,
  SUI: 20947,
  POL: 28321,
  RENDER: 5690,
  ARB: 11841,
  OP: 11840,
  HYPE: 32196,
  IP: 35626,
  WLFI: 33251,
};

// Custom Icons map for tokens not in CMC_IDS (extensible for future use)
const CUSTOM_ICONS: Record<string, string> = {};

/**
 * Module-level fallback color mapping for degraded icon rendering.
 * Keys are token symbols; values are Tailwind class strings.
 * ADA uses a white background with blue text for brand consistency.
 */
const FALLBACK_COLORS: Record<string, string> = {
  BTC: 'bg-[#F7931A] text-white',
  ETH: 'bg-[#627EEA] text-white',
  BNB: 'bg-[#F3BA2F] text-white',
  SOL: 'bg-[#000000] text-white',
  XRP: 'bg-[#23292F] text-white',
  DOGE: 'bg-[#C2A633] text-white',
  ADA: 'bg-[#FFFFFF] text-[#0033AD] border-[#0033AD]/20',
  AVAX: 'bg-[#E84142] text-white',
  PEPE: 'bg-[#00A526] text-white',
  HYPE: 'bg-[#00A526] text-white',
  SHIB: 'bg-[#FF0000] text-white',
  ARB: 'bg-[#2D3748] text-white',
  IP: 'bg-[#2D3748] text-white',
  WLFI: 'bg-[#2D3748] text-white',
  BCH: 'bg-[#8DC351] text-white',
  XLM: 'bg-[#0F172A] text-white',
  HBAR: 'bg-[#000000] text-white',
  LTC: 'bg-[#345D9D] text-white',
  SUI: 'bg-[#4DA2FF] text-white',
  ZEC: 'bg-[#ECB244] text-slate-900',
  UNI: 'bg-[#FF007A] text-white',
  AAVE: 'bg-[#B6509E] text-white',
  NEAR: 'bg-[#111827] text-white',
  ICP: 'bg-[#6B5CFF] text-white',
  ETC: 'bg-[#3AB83A] text-white',
  ONDO: 'bg-[#0B1A37] text-white',
  POL: 'bg-[#7C3AED] text-white',
  QNT: 'bg-[#1D4ED8] text-white',
  ATOM: 'bg-[#1F2937] text-white',
  ALGO: 'bg-[#111827] text-white',
  APT: 'bg-[#0F172A] text-white',
  RENDER: 'bg-[#FFFFFF] text-[#FF4D4F] border-[#FF4D4F]/20',
  FIL: 'bg-[#00C1F5] text-white',
  VET: 'bg-[#15BDFF] text-white',
  CRO: 'bg-[#1B2A49] text-white',
};

const DEFAULT_FALLBACK = 'bg-slate-600 text-white';

/** Tokens that require a solid white background behind the icon image */
const WHITE_BG_TOKENS = new Set(['ADA', 'APT', 'ONDO', 'RENDER']);
const ICON_SCALE_OVERRIDES: Record<string, number> = {
  RENDER: 0.8,
};

const CryptoIcon: React.FC<CryptoIconProps> = ({ symbol, size = 40, className = '' }) => {
  const [error, setError] = useState(false);
  const [prevSymbol, setPrevSymbol] = useState(symbol);

  // Derived state: Reset error synchronously if symbol changes
  if (symbol !== prevSymbol) {
    setPrevSymbol(symbol);
    setError(false);
  }

  const s = symbol.toUpperCase();

  const cmcId = CMC_IDS[s];
  const customIcon = CUSTOM_ICONS[s];

  // Use 128x128 for High DPI screens
  const iconUrl = customIcon
    ? customIcon
    : cmcId
      ? `https://s2.coinmarketcap.com/static/img/coins/128x128/${cmcId}.png`
      : `https://assets.coincap.io/assets/icons/${s.toLowerCase()}@2x.png`;

  // Fallback UI (Colored Circle with Text)
  if (error) {
    const colorClasses = FALLBACK_COLORS[s] ?? DEFAULT_FALLBACK;

    return (
      <div
        className={`flex items-center justify-center rounded-full font-bold shadow-lg border border-white/10 ${colorClasses} ${className}`}
        style={{ width: size, height: size, fontSize: Math.max(10, size * 0.4) }}
      >
        {s[0]}
      </div>
    );
  }

  const needsWhiteBg = WHITE_BG_TOKENS.has(s);
  const iconScale = ICON_SCALE_OVERRIDES[s] ?? 1;
  const iconDisplaySize = size * iconScale;

  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden rounded-full ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Background layer: solid white for specific tokens, subtle glow for others */}
      <div
        data-testid={`crypto-icon-bg-${s}`}
        className={`absolute inset-0 rounded-full ${needsWhiteBg ? 'bg-white opacity-100' : 'bg-white opacity-5 blur-[1px]'}`}
      ></div>

      <img
        src={iconUrl}
        alt={symbol}
        width={iconDisplaySize}
        height={iconDisplaySize}
        className="rounded-full select-none relative z-10"
        style={{
          width: iconDisplaySize,
          height: iconDisplaySize,
          objectFit: 'contain',
        }}
        onError={() => setError(true)}
        loading="lazy"
      />
    </div>
  );
};

export default React.memo(CryptoIcon);
