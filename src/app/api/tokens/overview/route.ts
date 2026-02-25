import { NextRequest, NextResponse } from "next/server";

import { getTransactionsCollection, type StoredTransaction } from "@/lib/mongodb";
import { getAllPools } from "@/dapp/queries/registry";

export const dynamic = "force-dynamic";

type TokenOverview = {
    tokenCategory: string;
    symbol?: string;
    name?: string;
    iconUrl?: string;
    priceBch: number | null;
    tvlBch: number;
    volume30dBch: number;
    change1dPercent: number | null;
    change7dPercent: number | null;
};

type TokensOverviewResponse = {
    tokens: TokenOverview[];
    total: number;
};

function extractBchVolume(tx: StoredTransaction): number {
    const a = tx.amounts;
    if (!a) return 0;
    const candidates = [a.bchIn, a.bchOut].filter(
        (v): v is number => typeof v === "number" && Number.isFinite(v) && v > 0,
    );
    if (!candidates.length) return 0;
    return candidates[0]!;
}

export async function GET(_request: NextRequest) {
    try {
        const [{ pools }, txColl] = await Promise.all([getAllPools(), getTransactionsCollection()]);

        const now = Date.now();
        const dayMs = 24 * 60 * 60 * 1000;
        const last1dStart = now - dayMs;
        const last7dStart = now - 7 * dayMs;

        const tokensMap = new Map<
            string,
            {
                symbol?: string;
                name?: string;
                iconUrl?: string;
                tvlBch: number;
                // for weighted price by BCH liquidity
                priceNum: number;
                priceDen: number;
                volume30dBch: number;
                // price history (VWAP) for 1d / 7d
                price1dNum: number;
                price1dDen: number;
                price7dNum: number;
                price7dDen: number;
            }
        >();

        for (const pool of pools) {
            const existing = tokensMap.get(pool.tokenCategory) ?? {
                symbol: pool.tokenSymbol,
                name: pool.tokenName,
                iconUrl: pool.tokenIconUrl,
                tvlBch: 0,
                priceNum: 0,
                priceDen: 0,
                volume30dBch: 0,
                price1dNum: 0,
                price1dDen: 0,
                price7dNum: 0,
                price7dDen: 0,
            };

            existing.tvlBch += pool.bchReserve;
            // weight token price by BCH liquidity
            existing.priceNum += pool.tokenPriceInBch * pool.bchReserve;
            existing.priceDen += pool.bchReserve;

            if (!existing.symbol && pool.tokenSymbol) existing.symbol = pool.tokenSymbol;
            if (!existing.name && pool.tokenName) existing.name = pool.tokenName;
            if (!existing.iconUrl && pool.tokenIconUrl) existing.iconUrl = pool.tokenIconUrl;

            tokensMap.set(pool.tokenCategory, existing);
        }

        const tokenCategories = Array.from(tokensMap.keys());

        if (tokenCategories.length > 0) {
            const last30Start = now - 30 * dayMs;

            const recentSwaps = await txColl
                .find({
                    type: "swap",
                    tokenCategory: { $in: tokenCategories },
                    createdAt: { $gte: last30Start },
                })
                .toArray();

            for (const tx of recentSwaps) {
                if (!tx.tokenCategory) continue;
                const entry = tokensMap.get(tx.tokenCategory);
                if (!entry) continue;

                const volumeBch = extractBchVolume(tx);
                if (!volumeBch) continue;
                entry.volume30dBch += volumeBch;

                // derive trade price (BCH per token) from recorded amounts
                const a = tx.amounts;
                if (!a) continue;
                let tradePrice: number | null = null;

                if (
                    tx.direction === "bch_to_token" &&
                    typeof a.bchIn === "number" &&
                    typeof a.tokenOut === "number" &&
                    a.bchIn > 0 &&
                    a.tokenOut > 0
                ) {
                    tradePrice = a.bchIn / a.tokenOut;
                } else if (
                    tx.direction === "token_to_bch" &&
                    typeof a.bchOut === "number" &&
                    typeof a.tokenIn === "number" &&
                    a.bchOut > 0 &&
                    a.tokenIn > 0
                ) {
                    tradePrice = a.bchOut / a.tokenIn;
                }

                if (tradePrice == null || !Number.isFinite(tradePrice)) continue;

                // BCH volume-weighted average price
                if (tx.createdAt >= last7dStart) {
                    entry.price7dNum += tradePrice * volumeBch;
                    entry.price7dDen += volumeBch;
                }
                if (tx.createdAt >= last1dStart) {
                    entry.price1dNum += tradePrice * volumeBch;
                    entry.price1dDen += volumeBch;
                }
            }
        }

        const tokens: TokenOverview[] = Array.from(tokensMap.entries())
            .map(([category, data]) => {
                const priceBch =
                    data.priceDen > 0 && Number.isFinite(data.priceNum / data.priceDen)
                        ? data.priceNum / data.priceDen
                        : null;

                const avg1d =
                    data.price1dDen > 0 && Number.isFinite(data.price1dNum / data.price1dDen)
                        ? data.price1dNum / data.price1dDen
                        : null;
                const avg7d =
                    data.price7dDen > 0 && Number.isFinite(data.price7dNum / data.price7dDen)
                        ? data.price7dNum / data.price7dDen
                        : null;

                const change1dPercent =
                    priceBch != null && avg1d != null && avg1d !== 0
                        ? ((priceBch - avg1d) / Math.abs(avg1d)) * 100
                        : null;

                const change7dPercent =
                    priceBch != null && avg7d != null && avg7d !== 0
                        ? ((priceBch - avg7d) / Math.abs(avg7d)) * 100
                        : null;

                return {
                    tokenCategory: category,
                    symbol: data.symbol,
                    name: data.name,
                    iconUrl: data.iconUrl,
                    priceBch,
                    tvlBch: data.tvlBch,
                    volume30dBch: data.volume30dBch,
                    change1dPercent,
                    change7dPercent,
                };
            })
            .sort((a, b) => b.tvlBch - a.tvlBch);

        const body: TokensOverviewResponse = {
            tokens,
            total: tokens.length,
        };

        return NextResponse.json(body);
    } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to fetch tokens overview";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
