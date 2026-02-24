"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, ArrowDownRight, Info } from "lucide-react";

type PoolsResponse = {
  totalBchLiquidity: number;
};

type VolumeResponse = {
  volume24hBch: number;
  prev24hBch: number;
  volume30dBch: number;
  prev30dBch: number;
};

function formatBch(n: number): string {
  if (!Number.isFinite(n)) return "-";
  if (Math.abs(n) < 0.000001) return "0";
  const fixed = n.toFixed(6);
  const [intPart, decPart] = fixed.split(".");
  const intWithSep = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const dec = (decPart || "").replace(/0+$/, "");
  return dec ? `${intWithSep}.${dec}` : intWithSep;
}

function formatPercentChange(current: number, previous: number): { label: string; positive: boolean } {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) {
    return { label: "–", positive: true };
  }
  const change = ((current - previous) / Math.abs(previous)) * 100;
  const rounded = change.toFixed(2);
  return { label: `${rounded}%`, positive: change >= 0 };
}

export default function StatsOverview() {
  const [pools, setPools] = useState<PoolsResponse | null>(null);
  const [volume, setVolume] = useState<VolumeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      fetch("/api/pools")
        .then((res) => {
          if (!res.ok) {
            return res
              .json()
              .then((b) => Promise.reject(new Error(b?.error || res.statusText)));
          }
          return res.json();
        })
        .then((json: PoolsResponse) => json)
        .catch((err) => {
          throw new Error(
            err instanceof Error ? err.message : "Failed to load pools statistics",
          );
        }),
      fetch("/api/stats/volume")
        .then((res) => {
          if (!res.ok) {
            return res
              .json()
              .then((b) => Promise.reject(new Error(b?.error || res.statusText)));
          }
          return res.json();
        })
        .then((json: VolumeResponse) => json)
        .catch((err) => {
          throw new Error(
            err instanceof Error ? err.message : "Failed to load volume statistics",
          );
        }),
    ])
      .then(([poolsJson, volumeJson]) => {
        if (cancelled) return;
        setPools(poolsJson);
        setVolume(volumeJson);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load statistics");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const tvlBch = pools?.totalBchLiquidity ?? 0;
  const vol24 = volume?.volume24hBch ?? 0;
  const prev24 = volume?.prev24hBch ?? 0;
  const vol30 = volume?.volume30dBch ?? 0;
  const prev30 = volume?.prev30dBch ?? 0;

  const change24 = formatPercentChange(vol24, prev24);
  const change30 = formatPercentChange(vol30, prev30);

  const showPlaceholder = loading || error;

  return (
    <section className="w-full mt-4">
      <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
        Statistics
        <span className="text-xs font-medium text-muted-foreground border border-border/60 rounded-full px-2 py-0.5">
          BCH
        </span>
      </h2>

      <div className="grid gap-3 md:grid-cols-3">
        {/* TVL */}
        <div className="rounded-[24px] border bg-popover px-5 py-4 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>TVL</span>
            <Info className="size-3.5" />
          </div>
          <div className="text-2xl font-semibold text-foreground">
            {showPlaceholder ? (
              "…"
            ) : (
              <>
                {formatBch(tvlBch)} <span className="text-sm text-muted-foreground">BCH</span>
              </>
            )}
          </div>
        </div>

        {/* Volume 24h */}
        <div className="rounded-[24px] border bg-popover px-5 py-4 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Volume (24h)</span>
            <Info className="size-3.5" />
          </div>
          <div className="text-2xl font-semibold text-foreground">
            {showPlaceholder ? (
              "…"
            ) : (
              <>
                {formatBch(vol24)} <span className="text-sm text-muted-foreground">BCH</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-1 text-xs min-h-5">
            {showPlaceholder ? (
              <span className="text-muted-foreground">…</span>
            ) : change24.label === "–" ? (
              <span className="text-muted-foreground">–</span>
            ) : (
              <>
                {change24.positive ? (
                  <ArrowUpRight className="size-3 text-emerald-400" />
                ) : (
                  <ArrowDownRight className="size-3 text-red-400" />
                )}
                <span
                  className={
                    change24.positive ? "text-emerald-400" : "text-red-400"
                  }
                >
                  {change24.label}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Volume 30d */}
        <div className="rounded-[24px] border bg-popover px-5 py-4 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Volume (30d)</span>
            <Info className="size-3.5" />
          </div>
          <div className="text-2xl font-semibold text-foreground">
            {showPlaceholder ? (
              "…"
            ) : (
              <>
                {formatBch(vol30)} <span className="text-sm text-muted-foreground">BCH</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-1 text-xs min-h-5">
            {showPlaceholder ? (
              <span className="text-muted-foreground">…</span>
            ) : change30.label === "–" ? (
              <span className="text-muted-foreground">–</span>
            ) : (
              <>
                {change30.positive ? (
                  <ArrowUpRight className="size-3 text-emerald-400" />
                ) : (
                  <ArrowDownRight className="size-3 text-red-400" />
                )}
                <span
                  className={
                    change30.positive ? "text-emerald-400" : "text-red-400"
                  }
                >
                  {change30.label}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

