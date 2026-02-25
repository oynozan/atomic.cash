"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import SwapPanel from "@/components/Swap/Panel";
import TokenDetailHeader from "@/components/TokenDetail/Header";
import TokenDetailPriceChart from "@/components/TokenDetail/PriceChart";
import TokenDetailTradeHistory from "@/components/TokenDetail/TradeHistory";
import TokenDetailInfo from "@/components/TokenDetail/Info";
import { useEffect, useMemo, useState } from "react";
import { fetchJsonOnce } from "@/lib/fetchJsonOnce";
import { useTokensOverviewStore } from "@/store/tokensOverview";
import { useTokenPriceStore } from "@/store/tokenPrice";

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
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [reloadKey, setReloadKey] = useState(0);

    const overviewTokens = useTokensOverviewStore(s => s.data?.tokens ?? null);
    const overviewToken = useMemo(
        () => overviewTokens?.find(t => t.tokenCategory === tokenCategory) ?? null,
        [overviewTokens, tokenCategory],
    );

    useEffect(() => {
        if (!tokenCategory) {
            setLoading(false);
            return;
        }
        let cancelled = false;

        const run = async () => {
            setLoading(true);
            setError(null);
            setData(null);
            const url = `/api/tokens/${encodeURIComponent(tokenCategory)}`;
            try {
                const json = await fetchJsonOnce<TokenDetailResponse>(url);
                if (!cancelled) setData(json);
            } catch (err: unknown) {
                if (!cancelled) {
                    const message =
                        err instanceof Error && err.message ? err.message : "Failed to load token";
                    setError(message);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        void run();

        return () => {
            cancelled = true;
        };
    }, [tokenCategory, reloadKey]);

    if (!tokenCategory) {
        return (
            <section className="w-screen min-h-screen pt-44 pb-32 flex justify-center">
                <div className="home-container max-w-6xl text-center text-muted-foreground">
                    Invalid token.
                </div>
            </section>
        );
    }

    if (error) {
        return (
            <section className="w-screen min-h-screen pt-44 pb-32 flex justify-center">
                <div className="home-container max-w-6xl text-center">
                    <p className="text-destructive mb-4">{error}</p>
                    <Link href="/tokens" className="text-sm text-primary hover:underline">
                        Back to Tokens
                    </Link>
                </div>
            </section>
        );
    }

    const view: TokenDetailResponse = data ??
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
        <section className="w-screen min-h-screen pt-44 pb-32 flex justify-center">
            <div className="home-container max-w-6xl w-full">
                <div className="mb-6 flex items-center justify-between gap-4">
                    <TokenDetailHeader
                        data={{
                            symbol: view.symbol,
                            name: view.name,
                            iconUrl: view.iconUrl,
                            priceBch: view.priceBch,
                            change1dPercent: view.change1dPercent,
                            change7dPercent: view.change7dPercent,
                        }}
                    />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1.3fr)] gap-6">
                    {/* Left column: chart + trade history */}
                    <div className="space-y-6">
                        <TokenDetailPriceChart
                            tokenCategory={view.tokenCategory}
                            currentPrice={view.priceBch}
                            refreshKey={reloadKey}
                        />
                        <TokenDetailTradeHistory
                            tokenCategory={view.tokenCategory}
                            tokenSymbol={view.symbol}
                            tokenIconUrl={view.iconUrl}
                            refreshKey={reloadKey}
                        />
                    </div>

                    {/* Right column: swap + info */}
                    <div className="space-y-6">
                        <div className="rounded-[24px] border bg-popover p-5">
                            <SwapPanel
                                onSwapCompleted={() => {
                                    setReloadKey(key => key + 1);
                                    // So swap panel "Price" and header stay in sync
                                    useTokenPriceStore
                                        .getState()
                                        .invalidate(tokenCategory ?? undefined);
                                    useTokensOverviewStore.getState().invalidate();
                                    void useTokensOverviewStore.getState().fetch(true);
                                }}
                            />
                        </div>
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
