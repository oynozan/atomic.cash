"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

import { formatBchPrice } from "@/lib/utils";
import { useTokensOverviewStore, type TokenOverview } from "@/store/tokensOverview";
import { getSocket } from "@/lib/socket";

function formatNumber(n: number | null, maxDecimals = 6): string {
    if (n == null || !Number.isFinite(n)) return "-";
    const abs = Math.abs(n);
    let decimals = maxDecimals;
    // More decimals for small BCH values, fewer for larger: < 0.01 BCH -> 8 dec, < 1 BCH -> 6 dec, >= 1 BCH -> 4 dec (or given max).
    if (abs > 0 && abs < 0.01) decimals = Math.min(8, maxDecimals + 2);
    else if (abs < 1) decimals = Math.min(6, maxDecimals);
    else decimals = Math.min(4, maxDecimals);

    const fixed = n.toFixed(decimals);
    const [intPart, decPart] = fixed.split(".");
    const intWithSep = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    const dec = (decPart || "").replace(/0+$/, "");
    return dec ? `${intWithSep}.${dec}` : intWithSep;
}

function formatPercent(n: number | null): { label: string; positive: boolean } {
    // Treat null / NaN / ~0 as "no change" and show "–"
    if (n == null || !Number.isFinite(n) || Math.abs(n) < 0.005) {
        return { label: "–", positive: true };
    }
    const rounded = n.toFixed(2);
    return { label: `${rounded}%`, positive: n >= 0 };
}

export default function TokensTable() {
    const [search, setSearch] = useState("");
    const [sortMode, setSortMode] = useState<
        "tvl" | "priceAsc" | "priceDesc" | "gainers" | "losers" | "volume"
    >("tvl");

    // Global tokens overview snapshot from zustand store.
    const overviewData = useTokensOverviewStore(s => s.data);
    const loading = useTokensOverviewStore(s => s.loading);
    const error = useTokensOverviewStore(s => s.error);
    const fetchOverview = useTokensOverviewStore(s => s.fetch);

    // Debounced search value used for client-side filtering.
    const [debouncedSearch, setDebouncedSearch] = useState("");

    useEffect(() => {
        const handle = setTimeout(() => {
            setDebouncedSearch(search.trim());
        }, 300);
        return () => clearTimeout(handle);
    }, [search]);

    const PAGE_SIZE = 20;

    // Initial load of the global overview snapshot.
    useEffect(() => {
        void fetchOverview();
    }, [fetchOverview]);

    // Socket-driven refresh: when swaps or pool/liquidity events happen, refresh
    // the first page in the background so token prices/TVL/volume stay fresh
    // without needing a global auto-refresh interval.
    useEffect(() => {
        const socket = getSocket();
        if (!socket) return;

        const handleTokensOverviewEvent = () => {
            const store = useTokensOverviewStore.getState();
            store.invalidate();
            void store.fetch(true);
        };

        socket.on("transaction", handleTokensOverviewEvent);

        return () => {
            socket.off("transaction", handleTokensOverviewEvent);
        };
    }, []);

    const allTokens = useMemo(
        () => overviewData?.tokens ?? [],
        [overviewData?.tokens],
    );

    const filteredTokens = useMemo(() => {
        // Apply client-side search over the full snapshot first.
        const q = debouncedSearch.trim().toLowerCase();
        let base: TokenOverview[] = allTokens;
        if (q) {
            base = base.filter(t => {
                const symbol = t.symbol ?? "";
                const name = t.name ?? "";
                const category = t.tokenCategory;
                const haystack = `${symbol} ${name} ${category}`.toLowerCase();
                return haystack.includes(q);
            });
        }

        // Then sort the filtered list on the client.
        const sorted = [...base];
        if (sortMode === "tvl") {
            sorted.sort((a, b) => b.tvlBch - a.tvlBch);
        } else if (sortMode === "priceAsc") {
            sorted.sort((a, b) => (a.priceBch ?? 0) - (b.priceBch ?? 0));
        } else if (sortMode === "priceDesc") {
            sorted.sort((a, b) => (b.priceBch ?? 0) - (a.priceBch ?? 0));
        } else if (sortMode === "gainers") {
            sorted.sort((a, b) => {
                const av = a.change1dPercent ?? -Infinity;
                const bv = b.change1dPercent ?? -Infinity;
                return bv - av;
            });
        } else if (sortMode === "losers") {
            sorted.sort((a, b) => {
                const av = a.change1dPercent ?? Infinity;
                const bv = b.change1dPercent ?? Infinity;
                return av - bv;
            });
        } else if (sortMode === "volume") {
            sorted.sort((a, b) => b.volume30dBch - a.volume30dBch);
        }
        return sorted;
    }, [allTokens, debouncedSearch, sortMode]);
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

    const visibleTokens = useMemo(
        () => filteredTokens.slice(0, visibleCount),
        [filteredTokens, visibleCount],
    );

    // There are more tokens to show whenever our current visible window
    // is smaller than the filtered list. All data is loaded from the
    // global overview snapshot; "Load more" only reveals more locally.
    const hasMore = filteredTokens.length > visibleCount;

    if (!debouncedSearch && loading && !allTokens.length) {
        return (
            <div className="rounded-[24px] border bg-popover flex items-center justify-center py-10 px-6 text-muted-foreground">
                Loading tokens…
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

    // No tokens at all (and not searching): show a simple empty state.
    if (!debouncedSearch && !allTokens.length && !loading) {
        return (
            <div className="rounded-[24px] border bg-popover py-6 px-6 text-sm text-muted-foreground">
                No tokens yet.
            </div>
        );
    }

    return (
        <div className="rounded-[24px] border bg-popover py-4 px-4 flex flex-col gap-3">
            <div className="mb-2 flex flex-col gap-2 px-1 md:flex-row md:flex-wrap md:items-center md:justify-between">
                <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-sm font-semibold text-foreground">Tokens</h2>
                    <div className="flex flex-wrap items-center gap-1 rounded-full border bg-background/40 px-1 py-0.5 text-[11px]">
                        <button
                            type="button"
                            onClick={() => {
                                setSortMode("tvl");
                                setVisibleCount(PAGE_SIZE);
                            }}
                            className={`px-2 py-0.5 rounded-full ${
                                sortMode === "tvl"
                                    ? "bg-primary text-primary-foreground"
                                    : "text-muted-foreground"
                            }`}
                        >
                            TVL
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setSortMode("priceDesc");
                                setVisibleCount(PAGE_SIZE);
                            }}
                            className={`px-2 py-0.5 rounded-full ${
                                sortMode === "priceDesc"
                                    ? "bg-amber-400 text-amber-950"
                                    : "text-muted-foreground"
                            }`}
                        >
                            Price ↑
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setSortMode("priceAsc");
                                setVisibleCount(PAGE_SIZE);
                            }}
                            className={`px-2 py-0.5 rounded-full ${
                                sortMode === "priceAsc"
                                    ? "bg-amber-600 text-amber-50"
                                    : "text-muted-foreground"
                            }`}
                        >
                            Price ↓
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setSortMode("gainers");
                                setVisibleCount(PAGE_SIZE);
                            }}
                            className={`px-2 py-0.5 rounded-full ${
                                sortMode === "gainers"
                                    ? "bg-emerald-500 text-emerald-950"
                                    : "text-muted-foreground"
                            }`}
                        >
                            Top ↑
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setSortMode("losers");
                                setVisibleCount(PAGE_SIZE);
                            }}
                            className={`px-2 py-0.5 rounded-full ${
                                sortMode === "losers"
                                    ? "bg-red-500 text-red-50"
                                    : "text-muted-foreground"
                            }`}
                        >
                            Top ↓
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setSortMode("volume");
                                setVisibleCount(PAGE_SIZE);
                            }}
                            className={`px-2 py-0.5 rounded-full ${
                                sortMode === "volume"
                                    ? "bg-sky-500 text-sky-950"
                                    : "text-muted-foreground"
                            }`}
                        >
                            Vol
                        </button>
                    </div>
                </div>
                <input
                    type="text"
                    value={search}
                    onChange={e => {
                        setSearch(e.target.value);
                        setVisibleCount(PAGE_SIZE);
                    }}
                    placeholder="Search tokens"
                    className="w-full min-w-0 rounded-full border bg-background/40 px-3 py-1.5 text-xs outline-none placeholder:text-muted-foreground/70 md:w-56"
                />
            </div>

            {debouncedSearch && (
                <div className="px-1 text-[11px] text-muted-foreground">
                    {loading
                        ? "Searching tokens…"
                        : visibleTokens.length === 0
                          ? "No tokens match your search."
                          : null}
                </div>
            )}

            {/* Mobile: card list */}
            <div className="md:hidden space-y-2">
                {visibleTokens.map(t => {
                    const change1d = formatPercent(t.change1dPercent);
                    return (
                        <Link
                            key={t.tokenCategory}
                            href={`/swap/${t.tokenCategory}`}
                            className="block rounded-xl border border-border/60 bg-background/30 p-3 hover:bg-background/50 transition-colors"
                        >
                            <div className="flex items-center justify-between gap-3 mb-2">
                                <div className="flex items-center gap-2 min-w-0">
                                    {t.iconUrl && (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                            src={t.iconUrl}
                                            alt={t.symbol}
                                            className="size-8 rounded-full object-cover border border-background/40 shrink-0"
                                        />
                                    )}
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium truncate">
                                            {t.name ?? t.symbol ?? "Token"}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {t.symbol ?? t.tokenCategory.slice(0, 8)}
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right shrink-0">
                                    <p className="text-sm font-mono font-medium">
                                        {formatBchPrice(t.priceBch)} BCH
                                    </p>
                                    <div className="flex items-center justify-end gap-1 mt-0.5">
                                        {change1d.label !== "–" &&
                                            (change1d.positive ? (
                                                <ArrowUpRight className="size-3 text-emerald-400" />
                                            ) : (
                                                <ArrowDownRight className="size-3 text-red-400" />
                                            ))}
                                        <span
                                            className={
                                                change1d.label === "–"
                                                    ? "text-[11px] text-muted-foreground"
                                                    : change1d.positive
                                                      ? "text-[11px] text-emerald-400"
                                                      : "text-[11px] text-red-400"
                                            }
                                        >
                                            {change1d.label}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex justify-between text-[11px] text-muted-foreground">
                                <span>TVL: {formatNumber(t.tvlBch, 4)} BCH</span>
                                <span>30d Vol: {formatNumber(t.volume30dBch, 4)} BCH</span>
                            </div>
                        </Link>
                    );
                })}
            </div>

            {/* Desktop: table */}
            <div className="hidden md:block">
                <div className="grid grid-cols-[40px_minmax(0,2.5fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1.6fr)] px-3 py-2 text-[11px] text-muted-foreground border-b border-border/60">
                    <div>#</div>
                    <div>Token name</div>
                    <div>Price</div>
                    <div>1 day</div>
                    <div>7 days</div>
                    <div>TVL</div>
                    <div>30d Volume</div>
                </div>

                <div className="divide-y divide-border/40">
                    {visibleTokens.map((t, idx) => {
                        const change1d = formatPercent(t.change1dPercent);
                        const change7d = formatPercent(t.change7dPercent);

                        return (
                            <Link
                                key={t.tokenCategory}
                                href={`/swap/${t.tokenCategory}`}
                                className="grid grid-cols-[40px_minmax(0,2.5fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1.6fr)] items-center px-3 py-3 text-xs hover:bg-background/40 transition-colors cursor-pointer"
                            >
                                <div className="text-[11px] text-muted-foreground">{idx + 1}</div>

                                {/* Token name */}
                                <div className="flex items-center gap-2">
                                    {t.iconUrl && (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                            src={t.iconUrl}
                                            alt={t.symbol}
                                            className="size-6 rounded-full object-cover border border-background/40"
                                        />
                                    )}
                                    <div className="flex flex-col">
                                        <span className="text-xs font-medium">
                                            {t.name ?? t.symbol ?? "Token"}
                                        </span>
                                        <span className="text-[11px] text-muted-foreground">
                                            {t.symbol ?? t.tokenCategory.slice(0, 6)}
                                        </span>
                                    </div>
                                </div>

                                {/* Price */}
                                <div className="font-mono text-[11px]">
                                    {formatBchPrice(t.priceBch)} BCH
                                </div>

                                {/* 1 day */}
                                <div className="flex items-center gap-1">
                                    {change1d.label !== "–" &&
                                        (change1d.positive ? (
                                            <ArrowUpRight className="size-3 text-emerald-400" />
                                        ) : (
                                            <ArrowDownRight className="size-3 text-red-400" />
                                        ))}
                                    <span
                                        className={
                                            change1d.label === "–"
                                                ? "text-[11px] text-muted-foreground"
                                                : change1d.positive
                                                  ? "text-[11px] text-emerald-400"
                                                  : "text-[11px] text-red-400"
                                        }
                                    >
                                        {change1d.label}
                                    </span>
                                </div>

                                {/* 7 days */}
                                <div className="flex items-center gap-1">
                                    {change7d.label !== "–" &&
                                        (change7d.positive ? (
                                            <ArrowUpRight className="size-3 text-emerald-400" />
                                        ) : (
                                            <ArrowDownRight className="size-3 text-red-400" />
                                        ))}
                                    <span
                                        className={
                                            change7d.label === "–"
                                                ? "text-[11px] text-muted-foreground"
                                                : change7d.positive
                                                  ? "text-[11px] text-emerald-400"
                                                  : "text-[11px] text-red-400"
                                        }
                                    >
                                        {change7d.label}
                                    </span>
                                </div>

                                {/* TVL */}
                                <div className="font-mono text-[11px]">
                                    {formatNumber(t.tvlBch, 4)} BCH
                                </div>

                                {/* 30d Volume */}
                                <div className="font-mono text-[11px]">
                                    {formatNumber(t.volume30dBch, 4)} BCH
                                </div>
                            </Link>
                        );
                    })}
                </div>
            </div>

            {hasMore && (
                <button
                    type="button"
                    onClick={() => {
                        // Increase the visible window first so when new data
                        // arrives it becomes immediately visible.
                        setVisibleCount(prev =>
                            Math.min(prev + PAGE_SIZE, filteredTokens.length),
                        );
                    }}
                    disabled={loading}
                    className="mt-2 self-center inline-flex items-center justify-center rounded-full border bg-background/60 px-4 py-1.5 text-xs font-medium text-foreground hover:bg-background transition-colors"
                >
                    {loading ? "Loading…" : "Load more"}
                </button>
            )}
        </div>
    );
}

