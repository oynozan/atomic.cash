import { create } from "zustand";
import { fetchJsonOnce } from "@/lib/fetchJsonOnce";

const USER_POOLS_TTL_MS = 60_000; // 60 seconds – avoid refetching on every visit

export type UserPoolSummary = {
    poolAddress: string;
    poolOwnerPkhHex: string;
    tokenCategory: string;
    tokenSymbol?: string;
    tokenIconUrl?: string;
    bchReserve: number;
    tokenReserve: number;
    tokenPriceInBch: number;
};

export type UserPoolsResponse = {
    pools: UserPoolSummary[];
};

type Entry = {
    data: UserPoolsResponse;
    fetchedAt: number;
};

type UserPoolsState = {
    byAddress: Record<string, Entry>;
    loading: Record<string, boolean>;
    error: Record<string, string | null>;
    fetch: (address: string, force?: boolean) => Promise<UserPoolsResponse | null>;
    invalidate: (address?: string) => void;
    removePool: (address: string, poolAddress: string) => void;
};

export const useUserPoolsStore = create<UserPoolsState>((set, get) => ({
    byAddress: {},
    loading: {},
    error: {},

    fetch: async (address: string, force = false) => {
        const key = address;
        const entry = get().byAddress[key];
        const now = Date.now();

        if (!force && entry && now - entry.fetchedAt < USER_POOLS_TTL_MS) {
            return entry.data;
        }

        const hasEntry = !!entry;
        const silentRefresh = force && hasEntry;

        if (!silentRefresh) {
            set(state => ({
                loading: { ...state.loading, [key]: true },
                error: { ...state.error, [key]: null },
            }));
        }

        try {
            const url = `/api/user/pools?address=${encodeURIComponent(address)}`;
            const fetchOptions: RequestInit = force || !entry ? { cache: "no-store" } : {};
            const data = await fetchJsonOnce<UserPoolsResponse>(url, fetchOptions);
            set(state => ({
                byAddress: { ...state.byAddress, [key]: { data, fetchedAt: Date.now() } },
                error: { ...state.error, [key]: null },
                loading: silentRefresh ? state.loading : { ...state.loading, [key]: false },
            }));
            return data;
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Failed to load your pools";
            set(state => ({
                error: { ...state.error, [key]: msg },
                loading: silentRefresh ? state.loading : { ...state.loading, [key]: false },
            }));
            return null;
        }
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

    removePool: (address: string, poolAddress: string) => {
        set(state => {
            const entry = state.byAddress[address];
            if (!entry) return state;

            const nextPools = entry.data.pools.filter(pool => pool.poolAddress !== poolAddress);

            if (nextPools.length === entry.data.pools.length) {
                return state;
            }

            return {
                ...state,
                byAddress: {
                    ...state.byAddress,
                    [address]: {
                        ...entry,
                        data: {
                            ...entry.data,
                            pools: nextPools,
                        },
                    },
                },
            };
        });
    },
}));
