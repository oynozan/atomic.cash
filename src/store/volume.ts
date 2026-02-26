import { create } from "zustand";
import { fetchJsonOnce } from "@/lib/fetchJsonOnce";

const VOLUME_TTL_MS = 30_000; // 30 seconds – backend cache will handle heavy aggregation

export type VolumeResponse = {
    volume24hBch: number;
    prev24hBch: number;
    volume30dBch: number;
    prev30dBch: number;
    tvlBch: number;
    prev24hTvlBch: number;
    prev30dTvlBch: number;
};

type VolumeState = {
    data: VolumeResponse | null;
    error: string | null;
    loading: boolean;
    fetchedAt: number | null;
    fetch: (force?: boolean) => Promise<void>;
    invalidate: () => void;
};

export const useVolumeStore = create<VolumeState>((set, get) => ({
    data: null,
    error: null,
    loading: false,
    fetchedAt: null,

    fetch: async (force = false) => {
        const { data, fetchedAt } = get();
        if (!force && data && fetchedAt != null && Date.now() - fetchedAt < VOLUME_TTL_MS) {
            return;
        }
        set({ loading: true, error: null });
        try {
            const json = await fetchJsonOnce<VolumeResponse>("/api/stats/volume");
            set({ data: json, error: null, fetchedAt: Date.now() });
        } catch (err) {
            set({
                error: err instanceof Error ? err.message : "Failed to load volume stats",
            });
        } finally {
            set({ loading: false });
        }
    },

    invalidate: () => {
        set({ fetchedAt: null });
    },
}));
