import { create } from 'zustand';

export type MarketExecutionSource = 'BINANCE' | 'COINBASE';

interface MarketExecutionState {
  executableSources: Record<MarketExecutionSource, boolean>;
  setSourceExecutable: (source: MarketExecutionSource, executable: boolean) => void;
  resetExecutableSources: () => void;
}

const createDefaultExecutableSources = () => ({
  BINANCE: false,
  COINBASE: false,
});

export const useMarketExecutionStore = create<MarketExecutionState>((set) => ({
  executableSources: createDefaultExecutableSources(),
  setSourceExecutable: (source, executable) =>
    set((state) => {
      if (state.executableSources[source] === executable) {
        return state;
      }

      return {
        executableSources: {
          ...state.executableSources,
          [source]: executable,
        },
      };
    }),
  resetExecutableSources: () =>
    set({
      executableSources: createDefaultExecutableSources(),
    }),
}));
