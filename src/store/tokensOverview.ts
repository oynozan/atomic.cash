import { create } from "zustand";

const TOKENS_OVERVIEW_TTL_MS = 30_000; // 30 seconds – backend cache already protects heavy work
const TOKENS_OVERVIEW_AUTO_REFRESH_MS = 30_000;
let tokensOverviewAutoRefreshStarted = false;

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
  fetch: (force?: boolean) => Promise<void>;
  invalidate: () => void;
};

export const useTokensOverviewStore = create<TokensOverviewState>((set, get) => ({
  data: null,
  error: null,
  loading: false,
  fetchedAt: null,

  fetch: async (force = false) => {
    const { data, fetchedAt } = get();
    if (!force && data && fetchedAt != null && Date.now() - fetchedAt < TOKENS_OVERVIEW_TTL_MS) {
      return;
    }
    set({ loading: true, error: null });
    try {
      const res = await fetch("/api/tokens/overview");
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error((b?.error as string) || res.statusText);
      }
      const json: TokensOverviewResponse = await res.json();
      set({ data: json, error: null, fetchedAt: Date.now() });

      if (!tokensOverviewAutoRefreshStarted && typeof window !== "undefined") {
        tokensOverviewAutoRefreshStarted = true;
        window.setInterval(() => {
          const state = get();
          const { fetchedAt: fa } = state;
          if (!fa || Date.now() - fa >= TOKENS_OVERVIEW_TTL_MS) {
            void state.fetch(false);
          }
        }, TOKENS_OVERVIEW_AUTO_REFRESH_MS);
      }
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to load tokens",
      });
    } finally {
      set({ loading: false });
    }
  },

  invalidate: () => {
    set({ fetchedAt: null });
  },
}));
