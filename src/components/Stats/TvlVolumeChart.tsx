"use client";

import { useEffect, useRef, useState } from "react";
import {
    ColorType,
    LineSeries,
    HistogramSeries,
    createChart,
    TickMarkType,
    type IChartApi,
    type ISeriesApi,
    type LineData,
    type UTCTimestamp,
} from "lightweight-charts";

import { fetchJsonOnce } from "@/lib/fetchJsonOnce";
import { formatBchAmount } from "@/lib/utils";
import { getSocket } from "@/lib/socket";

type HistoryPoint = { timestamp: number; tvlBch: number; volumeBch: number };

type TvlVolumeHistoryResponse = {
    range: string;
    points: HistoryPoint[];
};

const RANGES = [
    { key: "7d", label: "1W" },
    { key: "30d", label: "1M" },
    { key: "90d", label: "Max" },
] as const;

type RangeKey = (typeof RANGES)[number]["key"];

const CHART_HEIGHT = 280;

export default function TvlVolumeChart() {
    const [range, setRange] = useState<RangeKey>("30d");
    const [data, setData] = useState<TvlVolumeHistoryResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);

    const containerRef = useRef<HTMLDivElement | null>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const tvlSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
    const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
    const rangeRef = useRef<RangeKey>(range);
    rangeRef.current = range;

    useEffect(() => {
        let cancelled = false;

        const run = async () => {
            setLoading(true);
            setError(null);
            try {
                const json = await fetchJsonOnce<TvlVolumeHistoryResponse>(
                    `/api/stats/tvl-volume-history?range=${range}`,
                );
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
    }, [range, refreshKey]);

    useEffect(() => {
        const socket = getSocket();
        if (!socket) return;

        const handleTvlEvent = () => {
            setRefreshKey(key => key + 1);
        };

        socket.on("transaction", handleTvlEvent);

        return () => {
            socket.off("transaction", handleTvlEvent);
        };
    }, []);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        if (chartRef.current) return;

        const textColor = "#94a3b8";
        const borderColor = "#334155";

        const formatLocalTime = (time: UTCTimestamp) => {
            const date = new Date((time as number) * 1000);
            const dateStr = date.toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
            });
            const timeStr = date.toLocaleTimeString(undefined, {
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
            });
            return `${dateStr}, ${timeStr}`;
        };

        const tickMarkFormatter = (time: UTCTimestamp, tickMarkType: TickMarkType) => {
            const date = new Date((time as number) * 1000);
            switch (tickMarkType) {
                case TickMarkType.Year:
                    return date.getFullYear().toString().slice(-2);
                case TickMarkType.Month:
                    return date.toLocaleDateString(undefined, { month: "short" }).slice(0, 3);
                case TickMarkType.DayOfMonth:
                    return date.getDate().toString();
                case TickMarkType.Time:
                    return date.toLocaleTimeString(undefined, {
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: true,
                    });
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

        const tvlSeries = chart.addSeries(LineSeries, {
            color: "#3b82f6",
            lineWidth: 2,
            priceScaleId: "right",
            priceFormat: {
                type: "custom",
                formatter: (p: number) => formatBchAmount(p),
            },
        });
        tvlSeriesRef.current = tvlSeries;

        const volumeSeries = chart.addSeries(HistogramSeries, {
            priceFormat: {
                type: "custom",
                formatter: (p: number) => formatBchAmount(p),
            },
            priceScaleId: "volume",
        });
        volumeSeries.priceScale().applyOptions({
            scaleMargins: { top: 0.7, bottom: 0 },
            borderVisible: false,
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
            tvlSeriesRef.current = null;
            chart.remove();
            chartRef.current = null;
        };
    }, []);

    useEffect(() => {
        const chart = chartRef.current;
        const tvlSeries = tvlSeriesRef.current;
        const volumeSeries = volumeSeriesRef.current;
        if (!chart || !tvlSeries || !volumeSeries) return;

        const points = data?.points ?? [];

        const tvlData: LineData[] = points.map(p => ({
            time: Math.floor(p.timestamp / 1000) as UTCTimestamp,
            value: p.tvlBch,
        }));
        tvlSeries.setData(tvlData);

        const volumeData = points.map(p => ({
            time: Math.floor(p.timestamp / 1000) as UTCTimestamp,
            value: p.volumeBch,
            color: "#64748b",
        }));
        volumeSeries.setData(volumeData);

        if (points.length > 0) {
            chart.timeScale().fitContent();
        }
    }, [data?.points]);

    const isLoading = loading && !data;
    const hasAnyData = !!(data && data.points.length > 0);

    return (
        <div className="rounded-[24px] border bg-popover p-4 flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-foreground">TVL & Volume</h2>
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
            {error && (
                <div className="py-2 text-center text-sm text-destructive">{error}</div>
            )}
            <div
                ref={containerRef}
                className="relative w-full max-w-full rounded-xl border border-border/60 bg-background/30 overflow-hidden"
                style={{ height: CHART_HEIGHT }}
            >
                {isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm bg-background/40">
                        Loading…
                    </div>
                )}
                {!isLoading && !hasAnyData && (
                    <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-xs bg-background/40">
                        No data for this period
                    </div>
                )}
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                    <span
                        className="inline-block w-3 h-0.5 rounded-full bg-[#3b82f6]"
                        aria-hidden
                    />
                    TVL (BCH)
                </span>
                <span className="flex items-center gap-1.5">
                    <span
                        className="inline-block w-3 h-2 rounded-sm bg-[#64748b]"
                        aria-hidden
                    />
                    Volume (BCH)
                </span>
            </div>
        </div>
    );
}
