import { create } from "zustand";

const POOLS_TTL_MS = 90_000; // 90 seconds – avoid refetch on every mount

export type ApiPool = {
  poolAddress: string;
  poolOwnerPkhHex: string;
  tokenCategory: string;
  tokenSymbol?: string;
  tokenName?: string;
  tokenIconUrl?: string;
  bchReserve: number;
  tokenReserve: number;
  tokenPriceInBch: number;
};

export type PoolsResponse = {
  totalPools: number;
  totalBchLiquidity: number;
  tokenCounts: Record<string, number>;
  pools: ApiPool[];
};

type PoolsState = {
  data: PoolsResponse | null;
  error: string | null;
  loading: boolean;
  fetchedAt: number | null;
  fetch: (force?: boolean) => Promise<void>;
  invalidate: () => void;
};

export const usePoolsStore = create<PoolsState>((set, get) => ({
  data: null,
  error: null,
  loading: false,
  fetchedAt: null,

  fetch: async (force = false) => {
    const { data, fetchedAt } = get();
    if (!force && data && fetchedAt != null && Date.now() - fetchedAt < POOLS_TTL_MS) {
      return;
    }
    set({ loading: true, error: null });
    try {
      const res = await fetch("/api/pools");
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error((b?.error as string) || res.statusText);
      }
      const json: PoolsResponse = await res.json();
      set({ data: json, error: null, fetchedAt: Date.now() });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to load pools",
      });
    } finally {
      set({ loading: false });
    }
  },

  invalidate: () => {
    set({ fetchedAt: null });
  },
}));
