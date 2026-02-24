import { create } from "zustand";

const BALANCES_TTL_MS = 60_000; // 60 seconds – invalidate after send/receive

export type PortfolioBalancesToken = {
  category: string;
  symbol?: string;
  name?: string | null;
  decimals?: number;
  amount: number;
  amountRaw?: string;
  iconUrl?: string | null;
};

export type PortfolioBalancesResponse = {
  bch: number;
  bchRaw: string;
  tokens: PortfolioBalancesToken[];
};

type Entry = {
  data: PortfolioBalancesResponse;
  fetchedAt: number;
  /** Cached total portfolio value in BCH (BCH balance + token amounts × prices) */
  portfolioBch?: number | null;
};

type PortfolioBalancesState = {
  byAddress: Record<string, Entry>;
  loading: Record<string, boolean>;
  error: Record<string, string | null>;
  fetch: (address: string, force?: boolean) => Promise<PortfolioBalancesResponse | null>;
  getCached: (address: string) => PortfolioBalancesResponse | null;
  setPortfolioBch: (address: string, value: number | null) => void;
  invalidate: (address?: string) => void;
};

export const usePortfolioBalancesStore = create<PortfolioBalancesState>((set, get) => ({
  byAddress: {},
  loading: {},
  error: {},

  fetch: async (address: string, force = false) => {
    const key = address;
    const entry = get().byAddress[key];
    if (!force && entry && Date.now() - entry.fetchedAt < BALANCES_TTL_MS) {
      return entry.data;
    }
    set(state => ({
      loading: { ...state.loading, [key]: true },
      error: { ...state.error, [key]: null },
    }));
    try {
      const res = await fetch(`/api/portfolio/balances?address=${encodeURIComponent(address)}`);
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error((b?.error as string) || res.statusText);
      }
      const data: PortfolioBalancesResponse = await res.json();
      set(state => ({
        byAddress: { ...state.byAddress, [key]: { data, fetchedAt: Date.now() } },
        loading: { ...state.loading, [key]: false },
        error: { ...state.error, [key]: null },
      }));
      return data;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load balances";
      set(state => ({
        loading: { ...state.loading, [key]: false },
        error: { ...state.error, [key]: msg },
      }));
      return null;
    }
  },

  getCached: (address: string) => {
    const entry = get().byAddress[address];
    if (!entry || Date.now() - entry.fetchedAt >= BALANCES_TTL_MS) return null;
    return entry.data;
  },

  setPortfolioBch: (address: string, value: number | null) => {
    const entry = get().byAddress[address];
    if (!entry) return;
    set(state => ({
      byAddress: {
        ...state.byAddress,
        [address]: { ...entry, portfolioBch: value },
      },
    }));
  },

  invalidate: (address?: string) => {
    if (address) {
      set(state => {
        const nextBy = { ...state.byAddress };
        delete nextBy[address];
        return { byAddress: nextBy };
      });
    } else {
      set({ byAddress: {} });
    }
  },
}));
