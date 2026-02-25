"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, ArrowDownRight, ExternalLink } from "lucide-react";

import { getExplorerUrl } from "@/dapp/explorer";
import { useTradesStore, type StoredTrade, type TokenMeta } from "@/store/trades";

function formatNumber(n: number, maxDecimals = 6): string {
    if (!Number.isFinite(n)) return "-";
    const fixed = n.toFixed(maxDecimals);
    const [intPart, decPart] = fixed.split(".");
    const intWithSep = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    const dec = (decPart || "").replace(/0+$/, "");
    return dec ? `${intWithSep}.${dec}` : intWithSep;
}

function formatTimeAgo(timestamp: number): string {
    const now = Date.now();
    const diffMs = Math.max(0, now - timestamp);
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    return `${diffDay}d ago`;
}

export default function TradesTable() {
    const data = useTradesStore(s => s.data);
    const loading = useTradesStore(s => s.loading);
    const error = useTradesStore(s => s.error);
    const fetchTrades = useTradesStore(s => s.fetch);
    const PAGE_SIZE = 20;
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

    useEffect(() => {
        void fetchTrades();
    }, [fetchTrades]);

    const trades = data?.trades ?? [];
    const tokenMeta = data?.tokenMeta ?? {};

    const visibleTrades = trades.slice(0, visibleCount);
    const hasMore = trades.length > visibleCount;

    if (loading && !data) {
        return (
            <div className="rounded-[24px] border bg-popover flex items-center justify-center py-10 px-6 text-muted-foreground">
                Loading trades…
            </div>
        );
    }

    if (error) {
        return (
            <div className="rounded-[24px] border border-destructive/50 bg-destructive/5 flex items-center justify-center py-10 px-6 text-destructive text-sm text-center">
                {error}
            </div>
        );
    }

    if (!trades.length) {
        return (
            <div className="rounded-[24px] border bg-popover py-6 px-6 text-sm text-muted-foreground">
                <div className="mb-4 flex items-center justify-between">
                    <div>
                        <div className="text-sm font-semibold text-foreground">Recent trades</div>
                        <div className="text-xs text-muted-foreground">No swaps recorded yet</div>
                    </div>
                </div>
                <p className="text-xs">
                    Once users start swapping on Atomic Cash, the most recent swaps will appear
                    here.
                </p>
            </div>
        );
    }

    return (
        <div className="rounded-[24px] border bg-popover py-4 px-4 flex flex-col gap-3">
            <div className="mb-2 flex items-center justify-between px-1">
                <div>
                    <div className="text-sm font-semibold text-foreground">Recent trades</div>
                    <div className="text-xs text-muted-foreground">
                        {data?.total ?? trades.length} trade
                        {(data?.total ?? trades.length) !== 1 ? "s" : ""}
                    </div>
                </div>
            </div>

            {/* Mobile: card list */}
            <div className="md:hidden space-y-2">
                {visibleTrades.map(tx => {
                    const meta = tx.tokenCategory ? tokenMeta[tx.tokenCategory] : undefined;
                    const isBuy = tx.direction === "bch_to_token";
                    const tokenAmount = (() => {
                        if (!tx.amounts) return null;
                        const { tokenOut, tokenIn } = tx.amounts;
                        if (isBuy) return tokenOut ?? null;
                        return tokenIn ?? null;
                    })();
                    const bchAmount = (() => {
                        if (!tx.amounts) return null;
                        const { bchIn, bchOut } = tx.amounts;
                        if (isBuy) return bchIn ?? null;
                        return bchOut ?? null;
                    })();
                    const txUrl = getExplorerUrl(tx.txid);
                    return (
                        <a
                            key={tx.txid}
                            href={txUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="block rounded-xl border border-border/60 bg-background/30 p-3 hover:bg-background/50 transition-colors"
                        >
                            <div className="flex items-center justify-between gap-2 mb-1">
                                <span className="text-[11px] text-muted-foreground">
                                    {formatTimeAgo(tx.createdAt)}
                                </span>
                                <span
                                    className={
                                        "text-xs font-medium " +
                                        (isBuy ? "text-emerald-400" : "text-red-400")
                                    }
                                >
                                    {isBuy ? "Buy" : "Sell"}
                                </span>
                            </div>
                            <div className="flex items-center justify-between gap-2 text-sm">
                                <div className="flex items-center gap-2 min-w-0">
                                    {meta?.iconUrl && (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                            src={meta.iconUrl}
                                            alt={meta.symbol}
                                            className="size-5 rounded-full object-cover border border-background/40 shrink-0"
                                        />
                                    )}
                                    <span className="font-mono truncate">
                                        {tokenAmount != null ? formatNumber(tokenAmount, 4) : "-"}{" "}
                                        {meta?.symbol ?? "Token"}
                                    </span>
                                </div>
                                <span className="font-mono text-muted-foreground shrink-0">
                                    {bchAmount != null ? formatNumber(bchAmount, 6) : "-"} BCH
                                </span>
                            </div>
                            <div className="mt-1 text-[11px] text-muted-foreground font-mono truncate">
                                {tx.txid.slice(0, 8)}…{tx.txid.slice(-6)}
                            </div>
                        </a>
                    );
                })}
            </div>

            {/* Desktop: table */}
            <div className="hidden md:block">
                <div className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,2.2fr)_minmax(0,2.2fr)_minmax(0,1.6fr)] px-3 py-2 text-[11px] text-muted-foreground border-b border-border/60">
                    <div>Time</div>
                    <div>Type</div>
                    <div>Token</div>
                    <div>For</div>
                    <div className="text-right">Transaction</div>
                </div>

                <div className="divide-y divide-border/40">
                {visibleTrades.map(tx => {
                    const meta = tx.tokenCategory ? tokenMeta[tx.tokenCategory] : undefined;
                    const isBuy = tx.direction === "bch_to_token";

                    const tokenAmount = (() => {
                        if (!tx.amounts) return null;
                        const { tokenOut, tokenIn } = tx.amounts;
                        if (isBuy) return tokenOut ?? null;
                        return tokenIn ?? null;
                    })();

                    const bchAmount = (() => {
                        if (!tx.amounts) return null;
                        const { bchIn, bchOut } = tx.amounts;
                        if (isBuy) return bchIn ?? null;
                        return bchOut ?? null;
                    })();

                    const txUrl = getExplorerUrl(tx.txid);

                    return (
                        <a
                            key={tx.txid}
                            href={txUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,2.2fr)_minmax(0,2.2fr)_minmax(0,1.6fr)] items-center px-3 py-3 text-xs hover:bg-background/40 transition-colors"
                        >
                            {/* Time */}
                            <div className="text-[11px] text-muted-foreground">
                                {formatTimeAgo(tx.createdAt)}
                            </div>

                            {/* Type */}
                            <div className="flex items-center gap-1">
                                {isBuy ? (
                                    <ArrowUpRight className="size-3 mr-1 text-emerald-400" />
                                ) : (
                                    <ArrowDownRight className="size-3 mr-1 text-red-400" />
                                )}
                                <span
                                    className={
                                        "text-xs font-medium " +
                                        (isBuy ? "text-emerald-400" : "text-red-400")
                                    }
                                >
                                    {isBuy ? "Buy" : "Sell"}
                                </span>
                            </div>

                            {/* Token */}
                            <div className="flex items-center gap-2">
                                {meta?.iconUrl && (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={meta.iconUrl}
                                        alt={meta.symbol}
                                        className="size-5 rounded-full object-cover border border-background/40"
                                    />
                                )}
                                <div className="flex flex-col">
                                    <span className="font-mono text-[11px]">
                                        {tokenAmount != null ? formatNumber(tokenAmount, 6) : "-"}
                                    </span>
                                    <span className="text-[11px] text-muted-foreground">
                                        {meta?.symbol ?? "Token"}
                                    </span>
                                </div>
                            </div>

                            {/* For */}
                            <div className="flex items-center gap-2">
                                <div className="size-5 rounded-full bg-primary/10 flex items-center justify-center">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src="/icons/bch.svg"
                                        alt="BCH"
                                        className="size-3.5 rounded-full"
                                    />
                                </div>
                                <div className="flex flex-col">
                                    <span className="font-mono text-[11px]">
                                        {bchAmount != null ? formatNumber(bchAmount, 8) : "-"}
                                    </span>
                                    <span className="text-[11px] text-muted-foreground">BCH</span>
                                </div>
                            </div>

                            {/* Transaction */}
                            <div className="flex items-center justify-end gap-2 text-[11px] text-muted-foreground">
                                <span className="font-mono">
                                    {tx.txid.slice(0, 6)}…{tx.txid.slice(-4)}
                                </span>
                                <ExternalLink className="size-3" />
                            </div>
                        </a>
                    );
                })}
                </div>
            </div>

            {hasMore && (
                <button
                    type="button"
                    onClick={() =>
                        setVisibleCount(prev => Math.min(prev + PAGE_SIZE, trades.length))
                    }
                    className="mt-2 self-center inline-flex items-center justify-center rounded-full border bg-background/60 px-4 py-1.5 text-xs font-medium text-foreground hover:bg-background transition-colors"
                >
                    Load more
                </button>
            )}
        </div>
    );
}
