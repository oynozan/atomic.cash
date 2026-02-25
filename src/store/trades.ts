"use client";

import { create } from "zustand";

import { fetchJsonOnce } from "@/lib/fetchJsonOnce";

export type StoredTrade = {
    txid: string;
    address: string;
    type: "swap";
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
    symbol?: string;
    name?: string;
    iconUrl?: string;
};

export type TradesResponse = {
    trades: StoredTrade[];
    total: number;
    tokenMeta?: Record<string, TokenMeta>;
};

type TradesState = {
    data: TradesResponse | null;
    error: string | null;
    loading: boolean;
    fetchedAt: number | null;
    fetch: () => Promise<TradesResponse | null>;
    invalidate: () => void;
};

const TRADES_TTL_MS = 60_000;

export const useTradesStore = create<TradesState>((set, get) => ({
    data: null,
    error: null,
    loading: false,
    fetchedAt: null,

    fetch: async () => {
        const { data, fetchedAt } = get();
        const now = Date.now();
        if (data && fetchedAt != null && now - fetchedAt < TRADES_TTL_MS) {
            return data;
        }

        set({ loading: true, error: null });
        try {
            const json = await fetchJsonOnce<TradesResponse>("/api/trades/recent?limit=50");
            set({ data: json, error: null, fetchedAt: Date.now() });
            return json;
        } catch (err) {
            set({
                error: err instanceof Error ? err.message : "Failed to load trades",
            });
            return null;
        } finally {
            set({ loading: false });
        }
    },

    invalidate: () => {
        set({ data: null, error: null, fetchedAt: null });
    },
}));

