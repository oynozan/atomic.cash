import { create } from "zustand";

const VOLUME_TTL_MS = 90_000; // 90 seconds

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
