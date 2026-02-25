import { create } from "zustand";
import { fetchJsonOnce } from "@/lib/fetchJsonOnce";

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
    fetch: (force?: boolean) => Promise<PoolsResponse | null>;
    invalidate: () => void;
};

export const usePoolsStore = create<PoolsState>((set, get) => ({
    data: null,
    error: null,
    loading: false,
    fetchedAt: null,

    fetch: async (force = false) => {
        const { data, fetchedAt } = get();
        const now = Date.now();
        if (!force && data && fetchedAt != null && now - fetchedAt < POOLS_TTL_MS) {
            return data;
        }

        set({ loading: true, error: null });
        try {
            const json = await fetchJsonOnce<PoolsResponse>("/api/pools");
            set({ data: json, error: null, fetchedAt: Date.now() });
            return json;
        } catch (err) {
            set({
                error: err instanceof Error ? err.message : "Failed to load pools",
            });
            return null;
        } finally {
            set({ loading: false });
        }
    },

    invalidate: () => {
        set({ fetchedAt: null });
    },
}));
