"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { ChevronDown, ChevronUp } from "lucide-react";
import { usePoolsStore, type ApiPool } from "@/store/pools";
import { getAddressExplorerUrl } from "@/dapp/explorer";

function formatNumber(n: number, maxDecimals = 4): string {
    if (!Number.isFinite(n)) return "-";
    const fixed = n.toFixed(maxDecimals);
    const [intPart, decPart] = fixed.split(".");
    const intWithSep = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    const dec = (decPart || "").replace(/0+$/, "");
    return dec ? `${intWithSep}.${dec}` : intWithSep;
}

export default function PoolsTable() {
    const { data, loading, error, fetch: fetchPools } = usePoolsStore();
    const [expandedToken, setExpandedToken] = useState<string | null>(null);

    useEffect(() => {
        fetchPools();
    }, [fetchPools]);

    const grouped = useMemo(() => {
        if (!data) return [];
        const map = new Map<
            string,
            {
                tokenCategory: string;
                tokenSymbol?: string;
                tokenIconUrl?: string;
                totalBch: number;
                totalToken: number;
                pools: ApiPool[];
            }
        >();

        for (const pool of data.pools) {
            const existing = map.get(pool.tokenCategory);
            if (existing) {
                existing.totalBch += pool.bchReserve;
                existing.totalToken += pool.tokenReserve;
                existing.pools.push(pool);
            } else {
                map.set(pool.tokenCategory, {
                    tokenCategory: pool.tokenCategory,
                    tokenSymbol: pool.tokenSymbol,
                    tokenIconUrl: pool.tokenIconUrl,
                    totalBch: pool.bchReserve,
                    totalToken: pool.tokenReserve,
                    pools: [pool],
                });
            }
        }

        return Array.from(map.values()).sort((a, b) => b.totalBch - a.totalBch);
    }, [data]);

    if (loading) {
        return (
            <div className="flex flex-col gap-6 rounded-[24px] border bg-popover p-8 text-center text-muted-foreground">
                Loading pools…
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col gap-6 rounded-[24px] border border-destructive/50 bg-destructive/5 p-8 text-center text-destructive">
                {error}
            </div>
        );
    }

    if (!data || data.pools.length === 0) {
        return (
            <div className="flex flex-col gap-6 rounded-[24px] border bg-popover p-8 text-center text-muted-foreground">
                No pools yet. Create a pool to list it here.
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="rounded-[24px] border bg-popover px-6 py-4 flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                    <span className="font-semibold text-foreground">{data.totalPools}</span> micro
                    pools across{" "}
                    <span className="font-semibold text-foreground">{grouped.length}</span> tokens
                </div>
                <div className="text-sm text-muted-foreground">
                    Total liquidity:{" "}
                    <span className="font-mono text-foreground">
                        {formatNumber(data.totalBchLiquidity, 4)} BCH
                    </span>
                </div>
            </div>

            {grouped.map(group => (
                <TokenGroupRow
                    key={group.tokenCategory}
                    group={group}
                    expanded={expandedToken === group.tokenCategory}
                    onToggle={() =>
                        setExpandedToken(prev =>
                            prev === group.tokenCategory ? null : group.tokenCategory,
                        )
                    }
                />
            ))}
        </div>
    );
}

/* eslint-disable @next/next/no-img-element */
function TokenAvatar({ symbol, iconUrl }: { symbol: string; iconUrl?: string }) {
    if (iconUrl) {
        return (
            <img
                src={iconUrl}
                alt={symbol}
                className="size-9 rounded-full object-cover border border-background/40"
            />
        );
    }
    return (
        <div className="size-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold">
            {symbol.slice(0, 1)}
        </div>
    );
}
/* eslint-enable @next/next/no-img-element */

function TokenGroupRow({
    group,
    expanded,
    onToggle,
}: {
    group: {
        tokenCategory: string;
        tokenSymbol?: string;
        tokenIconUrl?: string;
        totalBch: number;
        totalToken: number;
        pools: ApiPool[];
    };
    expanded: boolean;
    onToggle: () => void;
}) {
    const tokenLabel = group.tokenSymbol ?? group.tokenCategory.slice(0, 8) + "…";
    const priceTokenInBch =
        group.totalToken > 0 ? group.totalBch / group.totalToken : group.pools[0]?.tokenPriceInBch;
    const priceBchInToken =
        priceTokenInBch && priceTokenInBch > 0 ? 1 / priceTokenInBch : undefined;

    return (
        <div className="rounded-[24px] border bg-popover">
            <button
                type="button"
                onClick={onToggle}
                className="w-full px-6 py-5 flex items-center justify-between gap-4 cursor-pointer transition-colors hover:bg-secondary/80 rounded-[24px]"
            >
                <div className="flex items-center gap-4">
                    <div className="flex items-center -space-x-3">
                        <TokenAvatar symbol={tokenLabel} iconUrl={group.tokenIconUrl} />
                        <div className="size-9 rounded-full border border-background/40 bg-emerald-500/10 grid place-items-center">
                            <Image src="/icons/bch.svg" alt="BCH" width={24} height={24} />
                        </div>
                    </div>
                    <div className="flex flex-col items-start">
                        <span className="text-lg font-semibold">
                            {tokenLabel} <span className="text-muted-foreground">-</span> BCH
                        </span>
                        <div className="text-xs text-muted-foreground flex flex-wrap gap-2">
                            <span>
                                1 {tokenLabel} ≈{" "}
                                <span className="font-mono">
                                    {priceTokenInBch ? formatNumber(priceTokenInBch, 8) : "-"} BCH
                                </span>
                            </span>
                            <span className="opacity-60">·</span>
                            <span>
                                1 BCH ≈{" "}
                                <span className="font-mono">
                                    {priceBchInToken ? formatNumber(priceBchInToken, 4) : "-"}{" "}
                                    {tokenLabel}
                                </span>
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    <div className="text-right">
                        <div className="text-xs text-muted-foreground">Total liquidity</div>
                        <div className="font-mono text-sm">
                            {formatNumber(group.totalBch, 4)}{" "}
                            <span className="text-muted-foreground">BCH</span>
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                            {formatNumber(group.totalToken, 4)}{" "}
                            <span className="text-muted-foreground">{tokenLabel}</span>
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                            {group.pools.length} micro pool{group.pools.length > 1 ? "s" : ""}
                        </div>
                    </div>
                    <div className="rounded-full border bg-background/10 p-1">
                        {expanded ? (
                            <ChevronUp className="size-4 text-muted-foreground" />
                        ) : (
                            <ChevronDown className="size-4 text-muted-foreground" />
                        )}
                    </div>
                </div>
            </button>

            {expanded && (
                <div className="px-6 pb-4 pt-1 space-y-2">
                    {group.pools
                        .slice()
                        .sort((a, b) => b.bchReserve - a.bchReserve)
                        .map((pool, index) => {
                            const share =
                                group.totalBch > 0 ? (pool.bchReserve / group.totalBch) * 100 : 0;
                            return (
                                <div
                                    key={`${pool.poolOwnerPkhHex}-${pool.tokenCategory}-${index}`}
                                    className="flex items-center justify-between rounded-[16px] bg-background/40 px-4 py-3 text-xs"
                                >
                                    <div className="flex flex-col">
                                        <span className="font-medium">Micro pool #{index + 1}</span>
                                        <span className="text-[11px] text-muted-foreground">
                                            Owner PKH: {pool.poolOwnerPkhHex.slice(0, 10)}…
                                        </span>
                                        <a
                                            href={getAddressExplorerUrl(pool.poolAddress)}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-[11px] text-primary hover:underline"
                                        >
                                            Pool address:{" "}
                                            {pool.poolAddress.slice(0, 6)}…
                                            {pool.poolAddress.slice(-6)}
                                        </a>
                                    </div>
                                    <div className="flex items-center gap-4 text-right">
                                        <div>
                                            <div className="text-[11px] text-muted-foreground">
                                                Liquidity
                                            </div>
                                            <div className="font-mono">
                                                {formatNumber(pool.bchReserve, 4)}{" "}
                                                <span className="text-muted-foreground">BCH</span>
                                            </div>
                                            <div className="font-mono text-[11px] text-muted-foreground">
                                                {formatNumber(pool.tokenReserve, 4)}{" "}
                                                <span className="text-muted-foreground">
                                                    {tokenLabel}
                                                </span>
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-[11px] text-muted-foreground">
                                                Share
                                            </div>
                                            <div className="font-mono">
                                                {formatNumber(share, 2)}%
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                </div>
            )}
        </div>
    );
}
