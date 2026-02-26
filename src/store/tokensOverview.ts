import { create } from "zustand";
import { fetchJsonOnce } from "@/lib/fetchJsonOnce";

const TOKENS_OVERVIEW_TTL_MS = 30_000; // 30 seconds – backend cache already protects heavy work

export type TokenOverview = {
    tokenCategory: string;
    symbol?: string;
    name?: string;
    iconUrl?: string;
    priceBch: number | null;
    tvlBch: number;
    volume30dBch: number;
    change1dPercent: number | null;
    change7dPercent: number | null;
};

export type TokensOverviewResponse = {
    tokens: TokenOverview[];
    total: number;
};

type TokensOverviewState = {
    data: TokensOverviewResponse | null;
    error: string | null;
    loading: boolean;
    fetchedAt: number | null;
    fetch: (force?: boolean) => Promise<TokensOverviewResponse | null>;
    invalidate: () => void;
};

export const useTokensOverviewStore = create<TokensOverviewState>((set, get) => ({
    data: null,
    error: null,
    loading: false,
    fetchedAt: null,

    fetch: async (force = false) => {
        const { data, fetchedAt } = get();
        const now = Date.now();
        if (!force && data && fetchedAt != null && now - fetchedAt < TOKENS_OVERVIEW_TTL_MS) {
            return data;
        }

        set({ loading: true, error: null });
        try {
            const json = await fetchJsonOnce<TokensOverviewResponse>("/api/tokens/overview");
            set({ data: json, error: null, fetchedAt: Date.now() });
            return json;
        } catch (err) {
            set({
                error: err instanceof Error ? err.message : "Failed to load tokens",
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

