"use client";

import { useEffect } from "react";
import { ArrowUpRight, ArrowDownRight, Info } from "lucide-react";
import { useVolumeStore } from "@/store/volume";
import { formatBchAmount } from "@/lib/utils";

function formatPercentChange(
    current: number,
    previous: number,
): { label: string; positive: boolean } {
    if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) {
        return { label: "–", positive: true };
    }
    const change = ((current - previous) / Math.abs(previous)) * 100;
    const rounded = change.toFixed(2);
    return { label: `${rounded}%`, positive: change >= 0 };
}

export default function StatsOverview() {
    const {
        data: volumeData,
        loading: volumeLoading,
        error: volumeError,
        fetch: fetchVolume,
    } = useVolumeStore();

    useEffect(() => {
        fetchVolume();
    }, [fetchVolume]);

    const loading = volumeLoading;
    const error = volumeError;
    const tvlBch = volumeData?.tvlBch ?? 0;
    const prev24Tvl = volumeData?.prev24hTvlBch ?? 0;
    const prev30Tvl = volumeData?.prev30dTvlBch ?? 0;
    const vol24 = volumeData?.volume24hBch ?? 0;
    const prev24 = volumeData?.prev24hBch ?? 0;
    const vol30 = volumeData?.volume30dBch ?? 0;
    const prev30 = volumeData?.prev30dBch ?? 0;

    const changeTvl24 = formatPercentChange(tvlBch, prev24Tvl);
    const changeTvl30 = formatPercentChange(tvlBch, prev30Tvl);
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

            <div className="grid gap-5 md:grid-cols-3">
                {/* TVL */}
                <div className="rounded-[24px] border bg-popover px-5 py-4 flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>TVL</span>
                        <span
                            className="inline-flex items-center justify-center rounded-full border border-border/60 px-1 py-0.5 cursor-default"
                            aria-label="Total value locked across all pools (BCH value of BCH + token reserves)."
                            title="Total value locked across all pools (BCH value of BCH + token reserves)."
                        >
                            <Info className="size-3 opacity-70" />
                        </span>
                    </div>
                    <div className="text-2xl font-semibold text-foreground">
                        {showPlaceholder ? (
                            "…"
                        ) : (
                            <>
                                {formatBchAmount(tvlBch)}{" "}
                                <span className="text-sm text-muted-foreground">BCH</span>
                            </>
                        )}
                    </div>
                    <div className="flex flex-col gap-1 text-xs mt-1 min-h-9">
                        {showPlaceholder ? (
                            <span className="text-muted-foreground">…</span>
                        ) : (
                            <>
                                <div className="flex items-center gap-1">
                                    {prev24Tvl > 0 && changeTvl24.label !== "–" ? (
                                        <>
                                            {changeTvl24.positive ? (
                                                <ArrowUpRight className="size-3 text-emerald-400" />
                                            ) : (
                                                <ArrowDownRight className="size-3 text-red-400" />
                                            )}
                                            <span
                                                className={
                                                    changeTvl24.positive
                                                        ? "text-emerald-400"
                                                        : "text-red-400"
                                                }
                                            >
                                                {changeTvl24.label} (
                                                {formatBchAmount(tvlBch - prev24Tvl)} BCH)
                                            </span>
                                            <span className="text-muted-foreground">
                                                vs previous 24h
                                            </span>
                                        </>
                                    ) : (
                                        <span className="text-muted-foreground">
                                            – vs previous 24h
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-1">
                                    {prev30Tvl > 0 && changeTvl30.label !== "–" ? (
                                        <>
                                            {changeTvl30.positive ? (
                                                <ArrowUpRight className="size-3 text-emerald-400" />
                                            ) : (
                                                <ArrowDownRight className="size-3 text-red-400" />
                                            )}
                                            <span
                                                className={
                                                    changeTvl30.positive
                                                        ? "text-emerald-400"
                                                        : "text-red-400"
                                                }
                                            >
                                                {changeTvl30.label} (
                                                {formatBchAmount(tvlBch - prev30Tvl)} BCH)
                                            </span>
                                            <span className="text-muted-foreground">vs 30d ago</span>
                                        </>
                                    ) : (
                                        <span className="text-muted-foreground">– vs 30d ago</span>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* Volume 24h */}
                <div className="rounded-[24px] border bg-popover px-5 py-4 flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>Volume (24h)</span>
                        <span
                            className="inline-flex items-center justify-center rounded-full border border-border/60 px-1 py-0.5 cursor-default"
                            aria-label="Total swap volume in the last 24 hours (counting BCH side)."
                            title="Total swap volume in the last 24 hours (counting BCH side)."
                        >
                            <Info className="size-3 opacity-70" />
                        </span>
                    </div>
                    <div className="text-2xl font-semibold text-foreground">
                        {showPlaceholder ? (
                            "…"
                        ) : (
                            <>
                                {formatBchAmount(vol24)}{" "}
                                <span className="text-sm text-muted-foreground">BCH</span>
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
                        <span
                            className="inline-flex items-center justify-center rounded-full border border-border/60 px-1 py-0.5 cursor-default"
                            aria-label="Total swap volume in the last 30 days (counting BCH side)."
                            title="Total swap volume in the last 30 days (counting BCH side)."
                        >
                            <Info className="size-3 opacity-70" />
                        </span>
                    </div>
                    <div className="text-2xl font-semibold text-foreground">
                        {showPlaceholder ? (
                            "…"
                        ) : (
                            <>
                                {formatBchAmount(vol30)}{" "}
                                <span className="text-sm text-muted-foreground">BCH</span>
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
