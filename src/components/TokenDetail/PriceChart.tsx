"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchJsonOnce } from "@/lib/fetchJsonOnce";
import { formatBchPrice } from "@/lib/utils";

type Point = { timestamp: number; priceBch: number };

type PriceHistoryResponse = {
    tokenCategory: string;
    range: string;
    points: Point[];
};

const RANGES = [
    { key: "24h", label: "1D" },
    { key: "7d", label: "1W" },
    { key: "30d", label: "1M" },
] as const;

export default function PriceChart({
    tokenCategory,
    currentPrice,
    refreshKey = 0,
}: {
    tokenCategory: string;
    currentPrice: number | null;
    refreshKey?: number;
}) {
    const [range, setRange] = useState<"24h" | "7d" | "30d">("30d");
    const [data, setData] = useState<PriceHistoryResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        const run = async () => {
            setLoading(true);
            setError(null);
            setData(null);
            const param = range === "24h" ? "1d" : range === "7d" ? "7d" : "30d";
            const url = `/api/tokens/${encodeURIComponent(
                tokenCategory,
            )}/price-history?range=${param}`;
            try {
                const json = await fetchJsonOnce<PriceHistoryResponse>(url);
                if (!cancelled) {
                    setData(json);
                }
            } catch (err) {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : "Failed to load chart");
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        void run();

        return () => {
            cancelled = true;
        };
    }, [tokenCategory, range, refreshKey]);

    const { path, minPrice, maxPrice, viewBox } = useMemo(() => {
        const points = data?.points ?? [];
        const w = 400;
        const h = 120;

        // Hiç trade yoksa (veya tek nokta) ama geçerli bir currentPrice varsa,
        // düz bir hat çizelim; böylece "ölü" tokenler bile sabit fiyatlı grafik gösterir.
        if (!points.length || points.length < 2) {
            const p = currentPrice ?? 0;
            if (!Number.isFinite(p) || p <= 0) {
                return {
                    path: "",
                    minPrice: 0,
                    maxPrice: 0,
                    viewBox: `0 0 ${w} ${h}`,
                };
            }

            const spanP = Math.abs(p) * 0.1 || 1e-8;
            const loP = Math.max(0, p - spanP);
            const hiP = p + spanP;
            const rangeP = hiP - loP || 1e-12;
            const y = h - ((p - loP) / rangeP) * h;
            const d = `M 0 ${y} L ${w} ${y}`;

            return {
                path: d,
                minPrice: loP,
                maxPrice: hiP,
                viewBox: `0 0 ${w} ${h}`,
            };
        }

        // Son nokta olarak güncel spot fiyatı ekle: çizgi son swap'ın execution fiyatında
        // (küçük işlemde düşük kalabilir) değil, piyasa fiyatında biter.
        const now = Date.now();
        const withNow =
            typeof currentPrice === "number" && Number.isFinite(currentPrice) && currentPrice > 0
                ? [...points, { timestamp: now, priceBch: currentPrice }]
                : points;

        const minT = Math.min(...withNow.map(x => x.timestamp));
        const maxT = Math.max(...withNow.map(x => x.timestamp));
        const minP = Math.min(...withNow.map(x => x.priceBch));
        const maxP = Math.max(...withNow.map(x => x.priceBch));
        const spanT = maxT - minT || 1;

        // Keep price axis strictly positive and with sensible range
        const baseMin = Math.min(minP, currentPrice ?? minP);
        const baseMax = Math.max(maxP, currentPrice ?? maxP);
        const spanP = baseMax - baseMin;
        const padP = spanP > 0 ? spanP * 0.05 : (baseMin || 1) * 0.1;
        const loP = Math.max(0, baseMin - padP);
        const hiP = baseMax + padP;
        const rangeP = hiP - loP || 1e-12;

        const d = withNow
            .map(
                (pt, i) =>
                    `${i === 0 ? "M" : "L"} ${((pt.timestamp - minT) / spanT) * w} ${h - ((pt.priceBch - loP) / rangeP) * h}`,
            )
            .join(" ");

        return {
            path: d,
            minPrice: loP,
            maxPrice: hiP,
            viewBox: `0 0 ${w} ${h}`,
        };
    }, [data?.points, currentPrice]);

    return (
        <div className="rounded-[24px] border bg-popover p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground">Price</h2>
                <div className="flex gap-1">
                    {RANGES.map(r => (
                        <button
                            key={r.key}
                            type="button"
                            onClick={() => setRange(r.key)}
                            className={
                                "px-2.5 py-1 rounded-full text-xs font-medium transition-colors " +
                                (range === r.key
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-muted/50 text-muted-foreground hover:bg-muted")
                            }
                        >
                            {r.label}
                        </button>
                    ))}
                </div>
            </div>
            {error && <div className="py-6 text-center text-sm text-destructive">{error}</div>}
            {loading || !data ? (
                <div className="h-[120px] flex items-center justify-center text-muted-foreground text-sm">
                    Loading…
                </div>
            ) : (
                <div className="flex gap-4">
                    <div className="flex flex-col justify-between text-[11px] text-muted-foreground">
                        <span>{formatBchPrice(maxPrice)}</span>
                        <span>{formatBchPrice(minPrice)}</span>
                    </div>
                    <div className="flex-1 min-w-0 overflow-hidden">
                        {path ? (
                            <svg
                                viewBox={viewBox}
                                className="w-full h-[120px] text-primary"
                                preserveAspectRatio="none"
                            >
                                <defs>
                                    <linearGradient id="chartGradient" x1="0" y1="1" x2="0" y2="0">
                                        <stop
                                            offset="0%"
                                            stopColor="currentColor"
                                            stopOpacity="0.15"
                                        />
                                        <stop
                                            offset="100%"
                                            stopColor="currentColor"
                                            stopOpacity="0"
                                        />
                                    </linearGradient>
                                </defs>
                                <path
                                    d={path + (path ? ` L 400 120 L 0 120 Z` : "")}
                                    fill="url(#chartGradient)"
                                />
                                <path
                                    d={path}
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            </svg>
                        ) : (
                            <div className="h-[120px] flex items-center justify-center text-muted-foreground text-xs">
                                No price data for this period
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
