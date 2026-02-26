"use client";

import { create } from "zustand";

import { fetchJsonOnce } from "@/lib/fetchJsonOnce";

export type DappTxItem = {
    txid: string;
    address: string;
    type: "swap" | "create_pool" | "add_liquidity" | "remove_liquidity";
    direction?: "bch_to_token" | "token_to_bch";
    tokenCategory?: string;
    amounts?: {
        bchIn?: number;
        bchOut?: number;
        tokenIn?: number;
        tokenOut?: number;
    };
    createdAt: number;
};

export type TokenMeta = {
    symbol: string;
    name?: string;
    iconUrl?: string;
};

export type HistoryResponse = {
    dapp: {
        transactions: DappTxItem[];
        total: number;
        hasMore: boolean;
        nextCursor?: number;
    };
    tokenMeta?: Record<string, TokenMeta>;
};

type ActivityEntry = {
    data: HistoryResponse | null;
    loading: boolean;
    loadingMore: boolean;
    error: string | null;
    fetchedAt: number | null;
};

type ActivityState = {
    byAddress: Record<string, ActivityEntry>;
    fetchInitial: (address: string) => Promise<HistoryResponse | null>;
    fetchMore: (address: string) => Promise<HistoryResponse | null>;
    invalidate: (address?: string) => void;
};

const INITIAL_PAGE_SIZE = 20;
const ACTIVITY_TTL_MS = 60_000;

function buildUrl(_address: string, cursor?: number) {
    const params = new URLSearchParams();
    params.set("limit", String(INITIAL_PAGE_SIZE));
    if (cursor != null) params.set("cursor", String(cursor));
    return `/api/portfolio/history?${params.toString()}`;
}
export const usePortfolioActivityStore = create<ActivityState>((set, get) => ({
    byAddress: {},

    fetchInitial: async address => {
        const key = address.trim();
        if (!key) return null;

        const current = get().byAddress[key];
        const now = Date.now();
        if (current && current.data && current.fetchedAt && now - current.fetchedAt < ACTIVITY_TTL_MS) {
            return current.data;
        }

        set(state => ({
            byAddress: {
                ...state.byAddress,
                [key]: {
                    data: current?.data ?? null,
                    loading: true,
                    loadingMore: false,
                    error: null,
                    fetchedAt: current?.fetchedAt ?? null,
                },
            },
        }));

        try {
            const json = await fetchJsonOnce<HistoryResponse>(buildUrl(key), {
                credentials: "same-origin",
            });
            set(state => ({
                byAddress: {
                    ...state.byAddress,
                    [key]: {
                        data: json,
                        loading: false,
                        loadingMore: false,
                        error: null,
                        fetchedAt: Date.now(),
                    },
                },
            }));
            return json;
        } catch (err) {
            set(state => ({
                byAddress: {
                    ...state.byAddress,
                    [key]: {
                        data: current?.data ?? null,
                        loading: false,
                        loadingMore: false,
                        error:
                            err instanceof Error ? err.message : "Failed to load activity",
                        fetchedAt: current?.fetchedAt ?? null,
                    },
                },
            }));
            return null;
        }
    },

    fetchMore: async address => {
        const key = address.trim();
        if (!key) return null;

        const current = get().byAddress[key];
        const base = current?.data;
        if (!base || !base.dapp.hasMore || current?.loadingMore) {
            return base ?? null;
        }

        set(state => ({
            byAddress: {
                ...state.byAddress,
                [key]: {
                    ...(state.byAddress[key] ?? {
                        data: base,
                        loading: false,
                        error: null,
                        fetchedAt: null,
                    }),
                    loadingMore: true,
                },
            },
        }));

        try {
            const json = await fetchJsonOnce<HistoryResponse>(
                buildUrl(key, base.dapp.nextCursor),
                { credentials: "same-origin" },
            );

            const merged: HistoryResponse = {
                dapp: {
                    transactions: [...base.dapp.transactions, ...json.dapp.transactions],
                    total: json.dapp.total,
                    hasMore: json.dapp.hasMore,
                    nextCursor: json.dapp.nextCursor,
                },
                tokenMeta: {
                    ...(base.tokenMeta ?? {}),
                    ...(json.tokenMeta ?? {}),
                },
            };

            set(state => ({
                byAddress: {
                    ...state.byAddress,
                    [key]: {
                        data: merged,
                        loading: false,
                        loadingMore: false,
                        error: null,
                        fetchedAt: state.byAddress[key]?.fetchedAt ?? Date.now(),
                    },
                },
            }));

            return merged;
        } catch {
            set(state => ({
                byAddress: {
                    ...state.byAddress,
                    [key]: {
                        ...(state.byAddress[key] ?? {
                            data: base,
                            loading: false,
                            error: null,
                            fetchedAt: null,
                        }),
                        loadingMore: false,
                    },
                },
            }));
            return base;
        }
    },

    invalidate: address => {
        if (!address) {
            set({ byAddress: {} });
            return;
        }
        const key = address.trim();
        set(state => {
            const next = { ...state.byAddress };
            delete next[key];
            return { byAddress: next };
        });
    },
}));

