export const SUPPORT_CONTACT_TOKEN = '{{support-contact}}';

export const faqPage = {
  seoTitle: 'FAQ & Help',
  description:
    'Find answers about ZEROHUE, learn how the simulator works, and understand the execution model behind its paper trading engine.',
  heading: 'ZEROHUE FAQ',
  subheading: 'Answers about execution, storage, scoring, and simulator behavior.',
};

export const faqItems = [
  {
    question: 'What is ZEROHUE?',
    answer:
      'ZEROHUE is a local-first crypto trading simulator built for practice. It combines live market context, paper execution, and on-device persistence so traders can rehearse ideas without opening an exchange account or risking capital.',
  },
  {
    question: 'Is the market data real?',
    answer:
      'Yes. ZEROHUE uses live market feeds from Binance and Coinbase. The execution layer is simulated, but the prices and context visible in the interface are based on real exchange data.',
  },
  {
    question: 'Is my money real?',
    answer:
      'No. Every balance, holding, and order in ZEROHUE is simulated. The product is for practice only and does not custody funds or place real exchange orders.',
  },
  {
    question: 'How do I reset my account?',
    answer:
      'Since ZEROHUE is a simulator, you can reset it at any time. Use the reset workflow inside the terminal to clear the current simulation state and start again with a fresh balance.',
  },
  {
    question: 'What order types are supported?',
    answer:
      'ZEROHUE supports market orders, limit orders, take-profit targets, and stop-loss protection for buy-side practice scenarios. These controls are designed to mirror common execution decisions traders make in live markets.',
  },
  {
    question: 'How are repeated buys of the same asset tracked?',
    answer:
      'The engine tracks holdings as FIFO lots internally. Multiple buys of the same asset create separate lots with their own cost basis and timestamps, while the portfolio view stays aggregated for readability.',
  },
  {
    question: 'What is offline order execution?',
    answer:
      'ZEROHUE does not assume trades executed while you were disconnected. When the app starts or reconnects, it replays historical Binance and Coinbase candles from the last known online window to settle eligible limit orders and TP/SL triggers before the live engine resumes.',
  },
  {
    question: 'Are there any trading fees?',
    answer:
      'Yes. The simulator applies a standard 0.1% fee to transactions so practice results are closer to real execution conditions.',
  },
  {
    question: 'Where is my data stored?',
    answer:
      'Portfolio state and preferences are stored locally in browser storage, while orders, transactions, and market history are stored in IndexedDB. Trading records stay on the device instead of being uploaded to a proprietary backend.',
  },
  {
    question: 'How is the execution score calculated?',
    answer:
      'The execution score looks at risk control, profitability, stability, and confidence. The scoring system is intentionally conservative and pauses when the app cannot price every active exposure reliably.',
  },
  {
    question: 'Why is my valid trades count stuck at zero?',
    answer:
      'Only qualified FIFO lot closes count toward the confidence multiplier. A lot must be opened at at least 5% of total account equity at the moment of entry, remain open long enough, and be fully closed before it becomes a valid scored trade.',
  },
  {
    question: 'Why do I sometimes see "Price data incomplete"?',
    answer:
      'That warning appears when ZEROHUE cannot find a reliable live or fallback historical mark for part of the portfolio. In that state the app avoids optimistic valuation, and conservative scoring remains in effect.',
  },
  {
    question: 'How does region detection work?',
    answer:
      'ZEROHUE detects the best exchange endpoint for supported assets so the simulator can subscribe to the most appropriate feed for your region.',
  },
  {
    question: 'How do I contact support?',
    answer: `You can reach us through ${SUPPORT_CONTACT_TOKEN} for any questions about the simulator or legal matters.`,
  },
];

export const aboutPage = {
  seoTitle: 'About ZEROHUE',
  description:
    'Learn how ZEROHUE works: live market context, paper execution, FIFO lot accounting, and local-first storage for crypto practice.',
  heading: 'About ZEROHUE',
  subheading: 'Local-first crypto trading simulator',
  introTitle: 'What is ZEROHUE?',
  introParagraphs: [
    'ZEROHUE is a local-first crypto trading simulator built to close the gap between trading theory and repeated practice. The product combines live market context with deterministic paper execution so users can practice entries, exits, and review loops without opening or funding an exchange account.',
    'The simulator is designed to feel operational rather than decorative. Live market data arrives from Binance and Coinbase, simulated orders pass through a dedicated matching engine, and portfolio state is persisted on the device so practice history can survive restarts without a backend account system.',
    'ZEROHUE is intentionally conservative when data quality drops. If the platform cannot price active exposure with confidence, it surfaces warnings and avoids optimistic assumptions in scoring and valuation.',
    `Have questions or feedback? Reach us through ${SUPPORT_CONTACT_TOKEN}.`,
  ],
  simulationNotice:
    'ZEROHUE is strictly a simulation tool. It does not initiate live trades, custody assets, or solicit real deposits. Market context comes from public exchange feeds, while balances and results remain fictional.',
};

export const aboutFeatures = [
  {
    title: 'Live market context',
    description:
      'Binance and Coinbase feeds keep market context live while you rehearse decisions.',
    accent: 'text-emerald-400',
  },
  {
    title: 'Paper execution',
    description: 'Every order is simulated so traders can practice without financial exposure.',
    accent: 'text-blue-400',
  },
  {
    title: 'Offline execution replay',
    description:
      'Historical candle replay settles eligible offline orders before the live engine takes over.',
    accent: 'text-amber-400',
  },
  {
    title: 'FIFO lot accounting',
    description:
      'Each buy creates its own lot so PnL, exits, and scoring can stay grounded in execution order.',
    accent: 'text-violet-400',
  },
  {
    title: 'Client-side architecture',
    description:
      'Core state, persistence, and review history stay local to the browser instead of a hosted backend.',
    accent: 'text-purple-400',
  },
  {
    title: 'Smart routing',
    description:
      'Each asset stays mapped to a fixed source so the simulator can maintain a clear routing model.',
    accent: 'text-cyan-400',
  },
];

export const legalDocuments = {
  privacy: {
    title: 'Privacy Policy',
    description: 'Read the ZEROHUE privacy policy for the simulator and public website.',
    updatedLabel: 'Last Updated: March 2026',
    sections: [
      {
        title: '1. Data Collection',
        desc: 'All simulation data, including portfolios, orders, and configurations, is stored locally on your device using browser storage.',
      },
      {
        title: '2. No Tracking',
        desc: 'ZEROHUE does not use third-party trackers, analytics, or cookies to monitor trading behavior or application usage.',
      },
      {
        title: '3. Client-Side Architecture',
        desc: 'ZEROHUE is a client-side application. We do not transmit trading records, API keys, or assets to external servers.',
      },
      {
        title: '4. Full User Control',
        desc: 'You can wipe local data via browser settings or the reset workflows inside the simulator.',
      },
      {
        title: '5. Contact Information',
        desc: `Questions about this Privacy Policy? Reach us through ${SUPPORT_CONTACT_TOKEN}.`,
      },
    ],
  },
  terms: {
    title: 'Terms of Use',
    description: 'Read the ZEROHUE terms of use for the simulator and public website.',
    updatedLabel: 'Last Updated: March 2026',
    sections: [
      {
        title: '1. Acceptance of Terms',
        desc: 'By accessing and using this simulator, you agree to abide by these terms of use.',
      },
      {
        title: '2. Simulation Environment',
        desc: 'ZEROHUE is entirely a paper-trading simulation. Balances are virtual and have no real-world monetary value.',
      },
      {
        title: '3. User Conduct',
        desc: 'You agree not to exploit local APIs or use the platform for malicious activity, including attempts to abuse the matching engine.',
      },
      {
        title: '4. Service Availability',
        desc: 'As a local-first application, functionality depends on device state and public exchange connectivity.',
      },
      {
        title: '5. Contact Information',
        desc: `Questions about these Terms of Use? Reach us through ${SUPPORT_CONTACT_TOKEN}.`,
      },
    ],
  },
  disclaimer: {
    title: 'Risk Disclaimer',
    description: 'Read the ZEROHUE risk disclaimer for the simulator and public website.',
    updatedLabel: 'Last Updated: March 2026',
    sections: [
      {
        title: '1. Educational Purpose Only',
        desc: 'ZEROHUE is designed solely for educational and entertainment purposes. No real money or financial assets are involved.',
      },
      {
        title: '2. No Financial Advice',
        desc: 'Analytics, indicators, market data, and simulated results do not constitute financial, investment, or trading advice.',
      },
      {
        title: '3. Not an Exchange or Broker',
        desc: 'ZEROHUE is simulated software and is not registered as an exchange, broker, or financial institution in any jurisdiction.',
      },
      {
        title: '4. Data Accuracy',
        desc: 'Live market data is sourced for simulation purposes and may include delays or differ from institutional market conditions.',
      },
      {
        title: '5. Contact Information',
        desc: `Questions about this Risk Disclaimer? Reach us through ${SUPPORT_CONTACT_TOKEN}.`,
      },
    ],
  },
};
