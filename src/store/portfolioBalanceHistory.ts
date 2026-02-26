import { create } from "zustand";
import { fetchJsonOnce } from "@/lib/fetchJsonOnce";

const BALANCE_HISTORY_TTL_MS = 90_000; // 90 seconds

export type BalanceRange = "1d" | "7d" | "30d" | "90d";

export type BalanceHistoryPoint = { timestamp: number; valueBch: number; bch: number };

export type BalanceHistoryResponse = {
    points: BalanceHistoryPoint[];
    swapsThisWeek?: number;
    swappedThisWeekBch?: number;
};

type Entry = { data: BalanceHistoryResponse; fetchedAt: number };

type CacheKey = string;

function cacheKey(address: string, range: BalanceRange): CacheKey {
    return `${address}:${range}`;
}

type PortfolioBalanceHistoryState = {
    byKey: Record<CacheKey, Entry>;
    fetch: (
        address: string,
        force?: boolean,
        range?: BalanceRange,
    ) => Promise<BalanceHistoryResponse | null>;
    getCached: (address: string, range?: BalanceRange) => BalanceHistoryResponse | null;
    invalidate: (address?: string) => void;
};

export const usePortfolioBalanceHistoryStore = create<PortfolioBalanceHistoryState>((set, get) => ({
    byKey: {},

    fetch: async (address: string, force = false, range: BalanceRange = "30d") => {
        const key = cacheKey(address, range);
        const entry = get().byKey[key];
        const now = Date.now();
        if (!force && entry && now - entry.fetchedAt < BALANCE_HISTORY_TTL_MS) {
            return entry.data;
        }

        try {
            const url = `/api/portfolio/balance-history?range=${range}`;
            const raw = await fetchJsonOnce<BalanceHistoryResponse>(url, {
                credentials: "same-origin",
            });
            const data: BalanceHistoryResponse = {
                points: Array.isArray(raw?.points) ? raw.points : [],
                swapsThisWeek: raw?.swapsThisWeek,
                swappedThisWeekBch: raw?.swappedThisWeekBch,
            };
            set(state => ({
                byKey: {
                    ...state.byKey,
                    [key]: { data, fetchedAt: Date.now() },
                },
            }));
            return data;
        } catch {
            return null;
        }
    },

    getCached: (address: string, range: BalanceRange = "30d") => {
        const key = cacheKey(address, range);
        const entry = get().byKey[key];
        if (!entry || Date.now() - entry.fetchedAt >= BALANCE_HISTORY_TTL_MS) return null;
        return entry.data;
    },

    invalidate: (address?: string) => {
        if (address) {
            set(state => {
                const next = { ...state.byKey };
                for (const k of Object.keys(next)) {
                    if (k.startsWith(`${address}:`)) delete next[k];
                }
                return { byKey: next };
            });
        } else {
            set({ byKey: {} });
        }
    },
}));
