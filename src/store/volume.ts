import { create } from "zustand";

const VOLUME_TTL_MS = 30_000; // 30 seconds – backend cache will handle heavy aggregation
const VOLUME_AUTO_REFRESH_MS = 30_000;
let volumeAutoRefreshStarted = false;

export type VolumeResponse = {
  volume24hBch: number;
  prev24hBch: number;
  volume30dBch: number;
  prev30dBch: number;
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
      const res = await fetch("/api/stats/volume");
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error((b?.error as string) || res.statusText);
      }
      const json: VolumeResponse = await res.json();
      set({ data: json, error: null, fetchedAt: Date.now() });

      if (!volumeAutoRefreshStarted && typeof window !== "undefined") {
        volumeAutoRefreshStarted = true;
        window.setInterval(() => {
          const state = get();
          const { fetchedAt: fa } = state;
          if (!fa || Date.now() - fa >= VOLUME_TTL_MS) {
            void state.fetch(false);
          }
        }, VOLUME_AUTO_REFRESH_MS);
      }
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
