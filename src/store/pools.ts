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
    /** Current page (1-based) returned by the backend */
    page: number;
    /** Page size used by the backend */
    pageSize: number;
    /** Total unique token categories across all pools */
    totalTokenCategories: number;
    /** Total pages for the given pageSize */
    totalPages: number;
    pools: ApiPool[];
};

type PoolsState = {
    data: PoolsResponse | null;
    error: string | null;
    loading: boolean;
    fetchedAt: number | null;
    fetch: (force?: boolean, page?: number, pageSize?: number) => Promise<PoolsResponse | null>;
    invalidate: () => void;
};

export const usePoolsStore = create<PoolsState>((set, get) => ({
    data: null,
    error: null,
    loading: false,
    fetchedAt: null,

    fetch: async (force = false, page?: number, pageSize?: number) => {
        const { data, fetchedAt } = get();
        const now = Date.now();
        if (!force && data && fetchedAt != null && now - fetchedAt < POOLS_TTL_MS) {
            return data;
        }

        const params = new URLSearchParams();
        if (page != null) params.set("page", String(page));
        if (pageSize != null) params.set("pageSize", String(pageSize));
        const url = params.size ? `/api/pools?${params.toString()}` : "/api/pools";

        set({ loading: true, error: null });
        try {
            const json = await fetchJsonOnce<PoolsResponse>(url);
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
        // Clear cached data and timestamp so the next caller
        // is forced to refetch from /api/pools.
        set({ data: null, error: null, fetchedAt: null });
    },
}));
