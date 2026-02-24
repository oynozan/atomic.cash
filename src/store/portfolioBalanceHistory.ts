import { create } from "zustand";

const BALANCE_HISTORY_TTL_MS = 90_000; // 90 seconds

export type BalanceHistoryPoint = { timestamp: number; valueBch: number; bch: number };

export type BalanceHistoryResponse = {
  points: BalanceHistoryPoint[];
  swapsThisWeek?: number;
  swappedThisWeekBch?: number;
};

type Entry = { data: BalanceHistoryResponse; fetchedAt: number };

type PortfolioBalanceHistoryState = {
  byAddress: Record<string, Entry>;
  fetch: (address: string, force?: boolean) => Promise<BalanceHistoryResponse | null>;
  getCached: (address: string) => BalanceHistoryResponse | null;
  invalidate: (address?: string) => void;
};

export const usePortfolioBalanceHistoryStore = create<PortfolioBalanceHistoryState>((set, get) => ({
  byAddress: {},

  fetch: async (address: string, force = false) => {
    const key = address;
    const entry = get().byAddress[key];
    if (!force && entry && Date.now() - entry.fetchedAt < BALANCE_HISTORY_TTL_MS) {
      return entry.data;
    }
    try {
      const res = await fetch(
        `/api/portfolio/balance-history?address=${encodeURIComponent(address)}`,
      );
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error((b?.error as string) || res.statusText);
      }
      const data: BalanceHistoryResponse = await res.json();
      set(state => ({
        byAddress: {
          ...state.byAddress,
          [key]: { data, fetchedAt: Date.now() },
        },
      }));
      return data;
    } catch {
      return null;
    }
  },

  getCached: (address: string) => {
    const entry = get().byAddress[address];
    if (!entry || Date.now() - entry.fetchedAt >= BALANCE_HISTORY_TTL_MS) return null;
    return entry.data;
  },

  invalidate: (address?: string) => {
    if (address) {
      set(state => {
        const next = { ...state.byAddress };
        delete next[address];
        return { byAddress: next };
      });
    } else {
      set({ byAddress: {} });
    }
  },
}));
