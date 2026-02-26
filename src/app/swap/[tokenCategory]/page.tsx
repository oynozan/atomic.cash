"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";

import SwapPanel from "@/components/Swap/Panel";
import TokenDetailHeader from "@/components/TokenDetail/Header";
import TokenDetailPriceChart from "@/components/TokenDetail/PriceChart";
import TokenDetailTradeHistory from "@/components/TokenDetail/TradeHistory";
import TokenDetailInfo from "@/components/TokenDetail/Info";
import { useTokensOverviewStore } from "@/store/tokensOverview";
import { useTokenPriceStore } from "@/store/tokenPrice";
import { getSocket } from "@/lib/socket";

type TokenDetailResponse = {
    tokenCategory: string;
    symbol?: string;
    name?: string;
    iconUrl?: string;
    priceBch: number | null;
    tvlBch: number;
    tokenReserveTotal: number;
    volume24hBch: number;
    volume30dBch: number;
    prev24hBch: number;
    prev30dBch: number;
    change1dPercent: number | null;
    change7dPercent: number | null;
};

export default function SwapTokenPage() {
    const params = useParams();
    const tokenCategory = typeof params?.tokenCategory === "string" ? params.tokenCategory : null;
    const [data, setData] = useState<TokenDetailResponse | null>(null);
    const [lastIdentity, setLastIdentity] = useState<{
        tokenCategory: string;
        symbol?: string;
        name?: string;
        iconUrl?: string;
    } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [reloadKey, setReloadKey] = useState(0);

    const overviewTokens = useTokensOverviewStore(s => s.data?.tokens ?? null);
    const fetchTokensOverview = useTokensOverviewStore(s => s.fetch);
    const overviewToken = useMemo(
        () => overviewTokens?.find(t => t.tokenCategory === tokenCategory) ?? null,
        [overviewTokens, tokenCategory],
    );

    // Ensure tokens overview is fetched at least once while the user is on a
    // token detail page so that when they switch tokens, the header can use
    // symbol/name/icon from the overview response instead of falling back to
    // the generic "Token" placeholder.
    useEffect(() => {
        void fetchTokensOverview(false);
    }, [fetchTokensOverview]);

    useEffect(() => {
        if (!tokenCategory) {
            return;
        }
        let cancelled = false;

        const run = async () => {
            setError(null);
            try {
                const res = await fetch(
                    `/api/tokens/${encodeURIComponent(tokenCategory)}?ts=${Date.now()}`,
                    { cache: "no-store" },
                );
                if (!res.ok) {
                    throw new Error("Failed to load token");
                }
                const json = (await res.json()) as TokenDetailResponse;
                if (!cancelled) {
                    setData(json);
                }
            } catch (err: unknown) {
                if (!cancelled) {
                    const message =
                        err instanceof Error && err.message ? err.message : "Failed to load token";
                    setError(message);
                }
            } finally {
                // no-op
            }
        };

        void run();

        return () => {
            cancelled = true;
        };
    }, [tokenCategory, reloadKey]);

    // Preserve the last known token identity (name/symbol/icon) so that while
    // data is reloading (after a swap, for example) the header label does not
    // fall back to the generic "Token" placeholder. Price and change values
    // always come from the latest fetched data.
    useEffect(() => {
        if (!tokenCategory) return;

        const source =
            data ??
            (overviewToken && {
                tokenCategory,
                symbol: overviewToken.symbol,
                name: overviewToken.name,
                iconUrl: overviewToken.iconUrl,
            });

        if (!source) return;

        setLastIdentity(prev => {
            if (!prev || prev.tokenCategory !== source.tokenCategory) {
                return source;
            }
            if (prev.symbol !== source.symbol || prev.name !== source.name) {
                return source;
            }
            if (prev.iconUrl !== source.iconUrl) {
                return source;
            }
            return prev;
        });
    }, [tokenCategory, data, overviewToken]);

    // Listen for swap transactions for this token and refresh all token detail
    // views (header, chart, history, info) when a new swap is recorded.
    useEffect(() => {
        if (!tokenCategory) return;
        const socket = getSocket();
        if (!socket) return;

        type TxPayload = {
            type?: string;
            tokenCategory?: string;
        };

        const handleSwapTx = (payload: TxPayload) => {
            if (!payload || payload.type !== "swap") return;
            if (payload.tokenCategory !== tokenCategory) return;

            // Trigger refetch for chart + history (via refreshKey)
            setReloadKey(key => key + 1);

            // Invalidate cached price and overview so other views stay fresh too.
            useTokenPriceStore.getState().invalidate(tokenCategory);
            useTokensOverviewStore.getState().invalidate();
            void useTokensOverviewStore.getState().fetch(true);
        };

        socket.on("transaction:swap", handleSwapTx);

        return () => {
            socket.off("transaction:swap", handleSwapTx);
        };
    }, [tokenCategory]);

    if (!tokenCategory) {
        return (
            <section className="w-full min-w-0 min-h-screen pt-28 sm:pt-36 lg:pt-44 pb-24 sm:pb-32 flex justify-center">
                <div className="home-container max-w-6xl text-center text-muted-foreground">
                    Invalid token.
                </div>
            </section>
        );
    }

    if (error) {
        return (
            <section className="w-full min-w-0 min-h-screen pt-28 sm:pt-36 lg:pt-44 pb-24 sm:pb-32 flex justify-center">
                <div className="home-container max-w-6xl text-center">
                    <p className="text-destructive mb-4">{error}</p>
                    <Link href="/tokens" className="text-sm text-primary hover:underline">
                        Back to Tokens
                    </Link>
                </div>
            </section>
        );
    }

    const view: TokenDetailResponse =
        data ??
        (overviewToken && {
            tokenCategory,
            symbol: overviewToken.symbol,
            name: overviewToken.name,
            iconUrl: overviewToken.iconUrl,
            priceBch: overviewToken.priceBch,
            tvlBch: overviewToken.tvlBch,
            tokenReserveTotal: 0,
            volume24hBch: 0,
            volume30dBch: overviewToken.volume30dBch,
            prev24hBch: 0,
            prev30dBch: 0,
            change1dPercent: overviewToken.change1dPercent,
            change7dPercent: overviewToken.change7dPercent,
        }) ?? {
            tokenCategory,
            symbol: undefined,
            name: undefined,
            iconUrl: undefined,
            priceBch: null,
            tvlBch: 0,
            tokenReserveTotal: 0,
            volume24hBch: 0,
            volume30dBch: 0,
            prev24hBch: 0,
            prev30dBch: 0,
            change1dPercent: null,
            change7dPercent: null,
        };

    return (
        <section className="w-full min-w-0 min-h-screen pt-28 sm:pt-36 lg:pt-44 pb-24 sm:pb-32 flex justify-center px-2 sm:px-4">
            <div className="home-container max-w-6xl w-full min-w-0">
                <div className="mb-6 flex flex-wrap items-center justify-between gap-4 min-w-0">
                    <TokenDetailHeader
                        data={{
                            symbol: lastIdentity?.symbol ?? view.symbol,
                            name: lastIdentity?.name ?? view.name,
                            iconUrl: lastIdentity?.iconUrl ?? view.iconUrl,
                            priceBch: view.priceBch,
                            change1dPercent: view.change1dPercent,
                            change7dPercent: view.change7dPercent,
                        }}
                    />
                </div>

                {/* Mobile: swap → chart → history → info. Desktop: left col = chart+history (one block), right col = swap, info */}
                <div className="grid grid-cols-1 lg:grid-cols-2 lg:grid-rows-2 gap-4 sm:gap-6 min-w-0">
                    {/* Left column: Chart + History — on mobile "contents" so they flow with order; on desktop one cell spanning 2 rows */}
                    <div className="contents lg:flex lg:flex-col lg:gap-6 min-w-0 lg:col-start-1 lg:row-start-1 lg:row-end-3">
                        <div className="order-2 min-w-0">
                            <TokenDetailPriceChart
                                tokenCategory={view.tokenCategory}
                                currentPrice={view.priceBch}
                                refreshKey={reloadKey}
                            />
                        </div>
                        <div className="order-3 min-w-0">
                            <TokenDetailTradeHistory
                                tokenCategory={view.tokenCategory}
                                tokenSymbol={view.symbol}
                                tokenIconUrl={view.iconUrl}
                                refreshKey={reloadKey}
                            />
                        </div>
                    </div>

                    {/* Swap: below lg use justify-center to center panel; desktop right col */}
                    <div className="order-1 min-w-0 w-full flex justify-center lg:col-start-2 lg:row-start-1">
                        <div className="rounded-[24px] border bg-popover p-4 sm:p-5 w-full">
                            <Suspense>
                                <SwapPanel
                                    className="w-full mx-auto"
                                    initialToken={{
                                        category: view.tokenCategory,
                                        symbol: lastIdentity?.symbol ?? view.symbol,
                                        name: lastIdentity?.name ?? view.name,
                                        iconUrl: lastIdentity?.iconUrl ?? view.iconUrl,
                                        priceBch: view.priceBch,
                                        totalBchLiquidity: view.tvlBch,
                                    }}
                                    disableUrlPreselect
                                />
                            </Suspense>
                        </div>
                    </div>

                    {/* Info — fourth on mobile (order-4), bottom-right on desktop */}
                    <div className="order-4 min-w-0 lg:col-start-2 lg:row-start-2">
                        <TokenDetailInfo
                            data={{
                                tokenCategory: view.tokenCategory,
                                symbol: view.symbol,
                                name: view.name,
                                tvlBch: view.tvlBch,
                                tokenReserveTotal: view.tokenReserveTotal,
                                volume24hBch: view.volume24hBch,
                                volume30dBch: view.volume30dBch,
                                prev24hBch: view.prev24hBch,
                                prev30dBch: view.prev30dBch,
                            }}
                        />
                    </div>
                </div>
            </div>
        </section>
    );
}
