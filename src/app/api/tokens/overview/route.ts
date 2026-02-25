import { NextResponse } from "next/server";

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

function extractInitialPrice(tx: StoredTransaction): number | null {
    const a = tx.amounts;
    if (!a) return null;
    if (
        typeof a.bchIn === "number" &&
        typeof a.tokenIn === "number" &&
        a.bchIn > 0 &&
        a.tokenIn > 0
    ) {
        return a.bchIn / a.tokenIn;
    }
    return null;
}

export async function GET() {
    try {
        const [{ pools }, txColl] = await Promise.all([getAllPools(), getTransactionsCollection()]);

        const now = Date.now();
        const dayMs = 24 * 60 * 60 * 1000;

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

        const initialPriceByCategory = new Map<string, number>();

        if (tokenCategories.length > 0) {
            const last30Start = now - 30 * dayMs;

            // Volume (30d) from swaps
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
            }

            // Initial price from earliest create_pool for each token
            const initialTxs = await txColl
                .find({
                    type: "create_pool",
                    tokenCategory: { $in: tokenCategories },
                })
                .sort({ createdAt: 1 })
                .toArray();

            for (const tx of initialTxs) {
                if (!tx.tokenCategory) continue;
                if (initialPriceByCategory.has(tx.tokenCategory)) continue;
                const p0 = extractInitialPrice(tx);
                if (p0 == null || !Number.isFinite(p0) || p0 <= 0) continue;
                initialPriceByCategory.set(tx.tokenCategory, p0);
            }
        }

        const tokens: TokenOverview[] = Array.from(tokensMap.entries())
            .map(([category, data]) => {
                const priceBch =
                    data.priceDen > 0 && Number.isFinite(data.priceNum / data.priceDen)
                        ? data.priceNum / data.priceDen
                        : null;

                const initialPrice = initialPriceByCategory.get(category) ?? null;

                const changeSinceLaunch =
                    priceBch != null && initialPrice != null && initialPrice !== 0
                        ? ((priceBch - initialPrice) / Math.abs(initialPrice)) * 100
                        : null;

                // For now 1d and 7d both reflect change since pool creation.
                const change1dPercent = changeSinceLaunch;
                const change7dPercent = changeSinceLaunch;

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
