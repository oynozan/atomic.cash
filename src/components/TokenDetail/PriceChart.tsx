"use client";

import { useEffect, useRef, useState } from "react";
import {
    ColorType,
    LineSeries,
    CandlestickSeries,
    HistogramSeries,
    createChart,
    TickMarkType,
    type CandlestickData,
    type IChartApi,
    type ISeriesApi,
    type LineData,
    type UTCTimestamp,
} from "lightweight-charts";

import { fetchJsonOnce } from "@/lib/fetchJsonOnce";
import { formatBchAmount, formatBchPrice } from "@/lib/utils";

type Point = { timestamp: number; priceBch: number; volume?: number };

type PriceHistoryResponse = {
    tokenCategory: string;
    range: string;
    points: Point[];
};

const RANGES = [
    { key: "1h", label: "1H" },
    { key: "24h", label: "1D" },
    { key: "7d", label: "1W" },
    { key: "30d", label: "1M" },
    { key: "90d", label: "Max" },
] as const;

type RangeKey = (typeof RANGES)[number]["key"];
type ViewMode = "line" | "candles";

const CHART_HEIGHT = 280;

export default function PriceChart({
    tokenCategory,
    currentPrice,
    refreshKey = 0,
}: {
    tokenCategory: string;
    currentPrice: number | null;
    refreshKey?: number;
}) {
    const [range, setRange] = useState<RangeKey>("30d");
    const [mode, setMode] = useState<ViewMode>("line");
    const [data, setData] = useState<PriceHistoryResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const containerRef = useRef<HTMLDivElement | null>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const seriesRef = useRef<ISeriesApi<"Line" | "Candlestick"> | null>(null);
    const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
    const rangeRef = useRef<RangeKey>(range);
    rangeRef.current = range;
    const hasSpot =
        typeof currentPrice === "number" && Number.isFinite(currentPrice) && currentPrice > 0;

    // Fetch history for selected range
    useEffect(() => {
        let cancelled = false;

        const run = async () => {
            setLoading(true);
            setError(null);
            const param =
                range === "1h"
                    ? "1h"
                    : range === "24h"
                      ? "1d"
                      : range === "7d"
                        ? "7d"
                        : range === "90d"
                          ? "90d"
                          : "30d";
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

    // Create chart once
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        if (chartRef.current) return;

        const textColor = "#94a3b8";
        const borderColor = "#334155";

        // Crosshair/tooltip: full local time (user timezone)
        const formatLocalTime = (time: UTCTimestamp) => {
            const date = new Date((time as number) * 1000);
            const r = rangeRef.current;
            const dateStr = date.toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
            });
            const timeStr = date.toLocaleTimeString(undefined, {
                hour: "numeric",
                minute: "2-digit",
                second: r === "1h" ? "2-digit" : undefined,
                hour12: true,
            });
            return `${dateStr}, ${timeStr}`;
        };

        // Footer tick marks: max 8 chars per label (library requirement), local time
        const tickMarkFormatter = (time: UTCTimestamp, tickMarkType: TickMarkType) => {
            const date = new Date((time as number) * 1000);
            switch (tickMarkType) {
                case TickMarkType.Year:
                    return date.getFullYear().toString().slice(-2); // "26"
                case TickMarkType.Month:
                    return date.toLocaleDateString(undefined, { month: "short" }).slice(0, 3); // "Feb"
                case TickMarkType.DayOfMonth:
                    return date.getDate().toString(); // "26"
                case TickMarkType.Time:
                    return date.toLocaleTimeString(undefined, {
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: true,
                    }); // "2:14 PM" -> 7 chars
                case TickMarkType.TimeWithSeconds:
                    return date.toLocaleTimeString(undefined, {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                        hour12: true,
                    }); // "2:14:00" style
                default:
                    return date.toLocaleTimeString(undefined, {
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: true,
                    });
            }
        };

        const chart = createChart(container, {
            width: container.clientWidth || 400,
            height: CHART_HEIGHT,
            layout: {
                background: { type: ColorType.Solid, color: "transparent" },
                textColor,
            },
            grid: {
                vertLines: { color: borderColor },
                horzLines: { color: borderColor },
            },
            rightPriceScale: {
                borderColor,
                textColor,
                borderVisible: true,
                scaleMargins: { top: 0.1, bottom: 0.4 },
                ticksVisible: true,
                ensureEdgeTickMarksVisible: true,
                visible: true,
                minimumWidth: 80,
            },
            timeScale: {
                borderColor,
                timeVisible: true,
                secondsVisible: false,
                rightOffset: 0,
                tickMarkFormatter,
            },
            crosshair: { mode: 0 },
            handleScroll: {
                mouseWheel: true,
                pressedMouseMove: true,
                horzTouchDrag: true,
                vertTouchDrag: false,
            },
            handleScale: {
                axisPressedMouseMove: true,
                mouseWheel: true,
                pinch: false,
            },
            localization: {
                timeFormatter: formatLocalTime,
            },
        });

        chartRef.current = chart;

        const volumeSeries = chart.addSeries(HistogramSeries, {
            priceFormat: {
                type: "custom",
                formatter: (p: number) => formatBchAmount(p),
            },
            priceScaleId: "",
        });
        volumeSeries.priceScale().applyOptions({
            scaleMargins: { top: 0.7, bottom: 0 },
        });
        volumeSeriesRef.current = volumeSeries;

        const ro = new ResizeObserver(entries => {
            for (const e of entries) {
                if (e.target === container) {
                    const { width, height } = e.contentRect;
                    chart.applyOptions({
                        width,
                        height: height || CHART_HEIGHT,
                    });
                }
            }
        });
        ro.observe(container);

        return () => {
            ro.disconnect();
            volumeSeriesRef.current = null;
            chart.remove();
            chartRef.current = null;
            seriesRef.current = null;
        };
    }, []);

    // Ensure correct series for current mode
    useEffect(() => {
        const chart = chartRef.current;
        if (!chart) return;

        if (seriesRef.current) {
            chart.removeSeries(seriesRef.current);
            seriesRef.current = null;
        }

        const priceScaleOpts = {
            borderColor: "#334155",
            textColor: "#94a3b8",
            borderVisible: true,
            scaleMargins: { top: 0.1, bottom: 0.4 },
            ticksVisible: true,
            ensureEdgeTickMarksVisible: true,
            visible: true,
            minimumWidth: 80,
        };

        if (mode === "line") {
            const series = chart.addSeries(LineSeries, {
                color: "#22c55e",
                lineWidth: 2,
                priceScaleId: "right",
                priceFormat: { type: "custom", formatter: (p: number) => formatBchPrice(p) },
            });
            chart.priceScale("right").applyOptions(priceScaleOpts);
            seriesRef.current = series;
        } else {
            const series = chart.addSeries(CandlestickSeries, {
                upColor: "#22c55e",
                downColor: "#ef4444",
                wickUpColor: "#22c55e",
                wickDownColor: "#ef4444",
                borderVisible: false,
                priceScaleId: "right",
                priceFormat: {
                    type: "custom",
                    formatter: (p: number) => formatBchPrice(p),
                },
                lastValueVisible: true,
            });
            chart.priceScale("right").applyOptions(priceScaleOpts);
            seriesRef.current = series;
        }
    }, [mode]);

    // Push data into series when history or mode changes
    useEffect(() => {
        const chart = chartRef.current;
        const series = seriesRef.current;
        if (!chart || !series) return;

        const rawPoints = data?.points ?? [];
        const points = [...rawPoints].sort((a, b) => a.timestamp - b.timestamp);

        if (mode === "line") {
            const byTime = new Map<number, LineData>();
            for (const p of points) {
                const t = Math.floor(p.timestamp / 1000);
                byTime.set(t, {
                    time: t as UTCTimestamp,
                    value: p.priceBch,
                });
            }

            if (hasSpot) {
                const nowSec = Math.floor(Date.now() / 1000);
                const spotVal = currentPrice as number;
                const existing = byTime.get(nowSec);
                byTime.set(nowSec, {
                    time: nowSec as UTCTimestamp,
                    value: existing ? spotVal : spotVal,
                });
            }

            const lineData: LineData[] = Array.from(byTime.values()).sort(
                (a, b) => (a.time as number) - (b.time as number),
            );

            (series as ISeriesApi<"Line">).setData(lineData);
        } else {
            const candles: CandlestickData[] = [];

            if (points.length === 0) {
                if (hasSpot) {
                    const t = Math.floor(Date.now() / 1000) as UTCTimestamp;
                    const v = currentPrice as number;
                    candles.push({ time: t, open: v, high: v, low: v, close: v });
                }
            } else {
                let prevClose = points[0]!.priceBch;
                let prevTimeSec = Math.floor(points[0]!.timestamp / 1000);
                candles.push({
                    time: prevTimeSec as UTCTimestamp,
                    open: prevClose,
                    high: prevClose,
                    low: prevClose,
                    close: prevClose,
                });

                for (let i = 1; i < points.length; i++) {
                    const p = points[i]!;
                    const tSec = Math.floor(p.timestamp / 1000);
                    if (tSec <= prevTimeSec) continue;
                    const t = tSec as UTCTimestamp;
                    const open = prevClose;
                    const close = p.priceBch;
                    const high = Math.max(open, close);
                    const low = Math.min(open, close);
                    candles.push({ time: t, open, high, low, close });
                    prevClose = close;
                    prevTimeSec = tSec;
                }

                if (hasSpot) {
                    const nowSec = Math.floor(Date.now() / 1000);
                    if (nowSec > prevTimeSec) {
                        const open = prevClose;
                        const close = currentPrice as number;
                        const high = Math.max(open, close);
                        const low = Math.min(open, close);
                        candles.push({
                            time: nowSec as UTCTimestamp,
                            open,
                            high,
                            low,
                            close,
                        });
                    }
                }
            }

            (series as ISeriesApi<"Candlestick">).setData(candles);
        }

        const volumeSeries = volumeSeriesRef.current;
        if (volumeSeries) {
            let prevPrice: number | null = null;
            const volumeData = points.map(p => {
                const isUp = prevPrice === null || p.priceBch >= prevPrice;
                prevPrice = p.priceBch;
                return {
                    time: Math.floor(p.timestamp / 1000) as UTCTimestamp,
                    value: typeof p.volume === "number" && p.volume > 0 ? p.volume : 0,
                    color: isUp ? "#22c55e" : "#ef4444",
                };
            });
            volumeSeries.setData(volumeData.length > 0 ? volumeData : []);
        }

        if (points.length > 0 || hasSpot) {
            chart.timeScale().fitContent();
        }

        chart.priceScale("right").applyOptions({
            visible: true,
            borderVisible: true,
            ticksVisible: true,
            ensureEdgeTickMarksVisible: true,
            minimumWidth: 80,
            textColor: "#94a3b8",
            borderColor: "#334155",
            scaleMargins: { top: 0.1, bottom: 0.4 },
        });
    }, [data?.points, currentPrice, hasSpot, mode]);

    const isLoading = loading && !data;
    const hasAnyData = !!(data && (data.points.length > 0 || hasSpot));

    return (
        <div className="rounded-[24px] border bg-popover p-4 flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold text-foreground">Price</h2>
                    <div className="inline-flex items-center gap-0.5 rounded-full border bg-muted/30 px-1 py-0.5 text-[11px]">
                        <button
                            type="button"
                            onClick={() => setMode("line")}
                            className={`rounded-full px-2 py-0.5 font-medium transition-colors ${
                                mode === "line"
                                    ? "bg-primary text-primary-foreground"
                                    : "text-muted-foreground hover:text-foreground"
                            }`}
                        >
                            Simple
                        </button>
                        <button
                            type="button"
                            onClick={() => setMode("candles")}
                            className={`rounded-full px-2 py-0.5 font-medium transition-colors ${
                                mode === "candles"
                                    ? "bg-emerald-500 text-emerald-950"
                                    : "text-muted-foreground hover:text-foreground"
                            }`}
                        >
                            Bars
                        </button>
                    </div>
                </div>
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
            {error && <div className="py-2 text-center text-sm text-destructive">{error}</div>}
            <div
                ref={containerRef}
                className="relative w-full max-w-full rounded-xl border border-border/60 bg-background/30 overflow-hidden"
                style={{
                    height: CHART_HEIGHT,
                }}
            >
                {isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm bg-background/40">
                        Loading…
                    </div>
                )}
                {!isLoading && !hasAnyData && (
                    <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-xs bg-background/40">
                        No price data for this period
                    </div>
                )}
            </div>
        </div>
    );
}

