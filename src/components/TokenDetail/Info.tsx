"use client";

import { ArrowUpRight, ExternalLink, Globe, Database, Info } from "lucide-react";
import { getTokenExplorerUrl } from "@/dapp/explorer";
import { formatBchAmount, formatBchCompact } from "@/lib/utils";

type TokenDetailInfoData = {
    tokenCategory: string;
    symbol?: string;
    name?: string;
    tvlBch: number;
    tokenReserveTotal: number;
    volume24hBch: number;
    volume30dBch: number;
    prev24hBch: number;
    prev30dBch: number;
    websiteUrl?: string;
};

function formatChange(current: number, prev: number): string {
    if (!Number.isFinite(prev) || prev === 0) return "–";
    const pct = ((current - prev) / Math.abs(prev)) * 100;
    const sign = pct >= 0 ? "+" : "";
    return `${sign}${pct.toFixed(2)}%`;
}

export default function TokenDetailInfo({
    data,
    description,
}: {
    data: TokenDetailInfoData;
    description?: string;
}) {
    const change24 = formatChange(data.volume24hBch, data.prev24hBch);
    const change30 = formatChange(data.volume30dBch, data.prev30dBch);
    const positive24 = data.prev24hBch > 0 && data.volume24hBch >= data.prev24hBch;
    const positive30 = data.prev30dBch > 0 && data.volume30dBch >= data.prev30dBch;
    const explorerUrl = getTokenExplorerUrl(data.tokenCategory);
    const bcmrUrl = explorerUrl;

    return (
        <div className="rounded-[24px] border bg-popover p-5 flex flex-col gap-5">
            <h2 className="text-sm font-semibold text-foreground">Info</h2>

            {description && <p className="text-xs text-muted-foreground">{description}</p>}

            <div className="flex flex-wrap gap-2">
                {data.websiteUrl && (
                    <a
                        href={data.websiteUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/40 px-3 py-1.5 text-xs text-foreground hover:bg-background/60 transition-colors"
                    >
                        <Globe className="size-3.5" />
                        Website
                    </a>
                )}
                <a
                    href={explorerUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/40 px-3 py-1.5 text-xs text-foreground hover:bg-background/60 transition-colors"
                >
                    <ExternalLink className="size-3.5" />
                    Token Explorer
                </a>
                <a
                    href={bcmrUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/40 px-3 py-1.5 text-xs text-foreground hover:bg-background/60 transition-colors"
                >
                    <Database className="size-3.5" />
                    BCMR token
                </a>
            </div>

            <div className="space-y-4">
                <div>
                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground mb-1">
                        <span>TVL</span>
                        <span
                            className="inline-flex items-center justify-center rounded-full border border-border/60 px-1 py-0.5 cursor-default"
                            aria-label="Total value locked in all pools for this token (BCH value of BCH + token reserves)."
                            title="Total value locked in all pools for this token (BCH value of BCH + token reserves)."
                        >
                            <Info className="size-3 opacity-70" />
                        </span>
                    </div>
                    <div className="text-xl font-semibold text-foreground">
                        {formatBchAmount(data.tvlBch)} BCH
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                        {formatBchAmount(data.tvlBch / 2)} BCH · {formatBchCompact(data.tokenReserveTotal)}{" "}
                        {data.symbol ?? "token"}
                    </div>
                </div>

                <div>
                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground mb-1">
                        <span>Volume (24h)</span>
                        <span
                            className="inline-flex items-center justify-center rounded-full border border-border/60 px-1 py-0.5 cursor-default"
                            aria-label="Total swap volume for this token in the last 24 hours (counting BCH side)."
                            title="Total swap volume for this token in the last 24 hours (counting BCH side)."
                        >
                            <Info className="size-3 opacity-70" />
                        </span>
                    </div>
                    <div className="text-xl font-semibold text-foreground">
                        {formatBchAmount(data.volume24hBch)} BCH
                    </div>
                    {data.prev24hBch > 0 && (
                        <div
                            className={
                                "inline-flex items-center gap-1 text-xs mt-0.5 " +
                                (positive24 ? "text-emerald-400" : "text-red-400")
                            }
                        >
                            <ArrowUpRight
                                className={"size-3 " + (positive24 ? "" : "rotate-180")}
                            />
                            {change24} vs previous 24h
                        </div>
                    )}
                </div>

                <div>
                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground mb-1">
                        <span>Volume (30d)</span>
                        <span
                            className="inline-flex items-center justify-center rounded-full border border-border/60 px-1 py-0.5 cursor-default"
                            aria-label="Total swap volume for this token in the last 30 days (counting BCH side)."
                            title="Total swap volume for this token in the last 30 days (counting BCH side)."
                        >
                            <Info className="size-3 opacity-70" />
                        </span>
                    </div>
                    <div className="text-xl font-semibold text-foreground">
                        {formatBchAmount(data.volume30dBch)} BCH
                    </div>
                    {data.prev30dBch > 0 && (
                        <div
                            className={
                                "inline-flex items-center gap-1 text-xs mt-0.5 " +
                                (positive30 ? "text-emerald-400" : "text-red-400")
                            }
                        >
                            <ArrowUpRight
                                className={"size-3 " + (positive30 ? "" : "rotate-180")}
                            />
                            {change30} vs previous 30d
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
