import { create } from "zustand";

const PRICE_TTL_MS = 60_000; // 60 seconds per token

type PriceEntry = { marketPrice: number; hasMarketPools: boolean; fetchedAt: number };

type TokenPriceState = {
  cache: Record<string, PriceEntry>;
  fetchPrice: (tokenCategory: string) => Promise<{ hasMarketPools: boolean; marketPrice: number } | null>;
  getCached: (tokenCategory: string) => { hasMarketPools: boolean; marketPrice: number } | null;
};

export const useTokenPriceStore = create<TokenPriceState>((set, get) => ({
  cache: {},

  fetchPrice: async (tokenCategory: string) => {
    const key = tokenCategory;
    const entry = get().cache[key];
    if (entry && Date.now() - entry.fetchedAt < PRICE_TTL_MS) {
      return { hasMarketPools: entry.hasMarketPools, marketPrice: entry.marketPrice };
    }
    try {
      const res = await fetch(`/api/pools/price?tokenCategory=${encodeURIComponent(tokenCategory)}`);
      if (!res.ok) return null;
      const data = await res.json();
      if (typeof data.marketPrice !== "number" || !data.hasMarketPools) return null;
      const newEntry: PriceEntry = {
        hasMarketPools: true,
        marketPrice: data.marketPrice,
        fetchedAt: Date.now(),
      };
      set(state => ({ cache: { ...state.cache, [key]: newEntry } }));
      return { hasMarketPools: true, marketPrice: data.marketPrice };
    } catch {
      return null;
    }
  },

  getCached: (tokenCategory: string) => {
    const entry = get().cache[tokenCategory];
    if (!entry || Date.now() - entry.fetchedAt >= PRICE_TTL_MS) return null;
    return { hasMarketPools: entry.hasMarketPools, marketPrice: entry.marketPrice };
  },
}));
