"use client";

import { useEffect, useMemo, useState } from "react";
import {
    usePortfolioBalanceHistoryStore,
    type BalanceHistoryResponse,
} from "@/store/portfolioBalanceHistory";
import { formatBchAmount } from "@/lib/utils";

const RANGES = [
    { key: "24h", label: "1D", ms: 24 * 60 * 60 * 1000 },
    { key: "7d", label: "1W", ms: 7 * 24 * 60 * 60 * 1000 },
    { key: "30d", label: "1M", ms: 30 * 24 * 60 * 60 * 1000 },
    { key: "90d", label: "3M", ms: 90 * 24 * 60 * 60 * 1000 },
] as const;

export default function PortfolioBalanceChart({
    address,
    initialData,
}: {
    address: string;
    initialData?: BalanceHistoryResponse | null;
}) {
    const getCached = usePortfolioBalanceHistoryStore(s => s.getCached);
    const fetchHistory = usePortfolioBalanceHistoryStore(s => s.fetch);
    const [range, setRange] = useState<"24h" | "7d" | "30d" | "90d">("30d");
    const [data, setData] = useState<BalanceHistoryResponse | null>(
        initialData ?? getCached(address) ?? null,
    );
    const [loading, setLoading] = useState(!initialData && !getCached(address));
    const [error, setError] = useState<string | null>(null);

    // Only fetch when no initialData and no cache (store handles TTL)
    useEffect(() => {
        if (!address) return;
        if (initialData != null) {
            setData(initialData);
            setLoading(false);
            return;
        }
        const cached = getCached(address);
        if (cached) {
            setData(cached);
            setLoading(false);
            return;
        }
        let cancelled = false;
        setLoading(true);
        setError(null);
        fetchHistory(address).then(result => {
            if (!cancelled) {
                if (result) {
                    setData(result);
                    setError(null);
                } else {
                    setError("Failed to load balance history");
                }
                setLoading(false);
            }
        });
        return () => {
            cancelled = true;
        };
    }, [address, initialData, getCached, fetchHistory]);

    useEffect(() => {
        if (initialData != null) {
            setData(initialData);
            setLoading(false);
        }
    }, [initialData]);

    const rangeMs = RANGES.find(r => r.key === range)?.ms ?? 30 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const from = now - rangeMs;

    const { path, minVal, maxVal, viewBox } = useMemo(() => {
        const allPoints = data?.points ?? [];
        const filtered = allPoints.filter(p => p.timestamp >= from);
        const w = 400;
        const h = 120;

        if (filtered.length === 0) {
            const v = allPoints.length > 0 ? allPoints[allPoints.length - 1]!.valueBch : 0;
            return {
                path: "",
                minVal: v,
                maxVal: v,
                viewBox: `0 0 ${w} ${h}`,
            };
        }

        // If we only have a single point in the selected range, synthesize
        // a flat line across the full width instead of a tiny triangle.
        const points =
            filtered.length === 1
                ? [{ ...filtered[0], timestamp: filtered[0].timestamp - 1 }, filtered[0]]
                : filtered;

        const minT = Math.min(...points.map(x => x.timestamp));
        const maxT = Math.max(...points.map(x => x.timestamp));
        const minP = Math.min(...points.map(x => x.valueBch));
        const maxP = Math.max(...points.map(x => x.valueBch));
        const spanT = maxT - minT || 1;

        const baseMin = minP;
        const baseMax = maxP;
        const spanP = baseMax - baseMin;
        const padP = spanP > 0 ? spanP * 0.05 : (baseMin || 0.001) * 0.1;
        const loP = Math.max(0, baseMin - padP);
        const hiP = baseMax + padP;
        const rangeP = hiP - loP || 1e-12;

        const d = points
            .map(
                (pt, i) =>
                    `${i === 0 ? "M" : "L"} ${((pt.timestamp - minT) / spanT) * w} ${h - ((pt.valueBch - loP) / rangeP) * h}`,
            )
            .join(" ");

        return {
            path: d,
            minVal: loP,
            maxVal: hiP,
            viewBox: `0 0 ${w} ${h}`,
        };
    }, [data?.points, from]);

    if (!address) return null;

    return (
        <div className="rounded-[24px] border bg-popover px-5 py-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground">Balance</h2>
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
            {!data ? (
                <div className="h-[120px] flex items-center justify-center text-muted-foreground text-sm">
                    Loading…
                </div>
            ) : (
                <div className="flex gap-4">
                    <div className="flex flex-col justify-between text-[11px] text-muted-foreground">
                        <span>{formatBchAmount(maxVal)} BCH</span>
                        <span>{formatBchAmount(minVal)} BCH</span>
                    </div>
                    <div className="flex-1 min-w-0 overflow-hidden">
                        {path ? (
                            <svg
                                viewBox={viewBox}
                                className="w-full h-[120px] text-primary"
                                preserveAspectRatio="none"
                            >
                                <defs>
                                    <linearGradient
                                        id="balanceChartGradient"
                                        x1="0"
                                        y1="1"
                                        x2="0"
                                        y2="0"
                                    >
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
                                    fill="url(#balanceChartGradient)"
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
                                No balance history for this period
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
