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

function extractTradePrice(tx: StoredTransaction): number | null {
    const a = tx.amounts;
    if (!a) return null;
    if (
        tx.direction === "bch_to_token" &&
        typeof a.bchIn === "number" &&
        typeof a.tokenOut === "number" &&
        a.bchIn > 0 &&
        a.tokenOut > 0
    ) {
        return a.bchIn / a.tokenOut;
    }
    if (
        tx.direction === "token_to_bch" &&
        typeof a.bchOut === "number" &&
        typeof a.tokenIn === "number" &&
        a.bchOut > 0 &&
        a.tokenIn > 0
    ) {
        return a.bchOut / a.tokenIn;
    }
    return null;
}

function baselinePriceSince(
    points: { timestamp: number; priceBch: number }[],
    since: number,
): number | null {
    if (!points.length) return null;
    let candidate: number | null = null;
    for (const p of points) {
        if (p.timestamp <= since) {
            candidate = p.priceBch;
        } else {
            break;
        }
    }
    if (candidate != null) return candidate;
    const after = points.find(p => p.timestamp > since);
    return after?.priceBch ?? null;
}

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const q = (searchParams.get("q") ?? "").trim().toLowerCase();

        const limitParam = searchParams.get("limit");
        const parsedLimit = limitParam ? Number.parseInt(limitParam, 10) : NaN;
        const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : null;

        const offsetParam = searchParams.get("offset");
        const parsedOffset = offsetParam ? Number.parseInt(offsetParam, 10) : NaN;
        const offset = Number.isFinite(parsedOffset) && parsedOffset >= 0 ? parsedOffset : 0;

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

            // DeFi standard: TVL includes both BCH and token side.
            // Each side worth the same in BCH → approx 2 * BCH reserve.
            existing.tvlBch += pool.bchReserve * 2;
            // weight token price by BCH liquidity
            existing.priceNum += pool.tokenPriceInBch * pool.bchReserve;
            existing.priceDen += pool.bchReserve;

            if (!existing.symbol && pool.tokenSymbol) existing.symbol = pool.tokenSymbol;
            if (!existing.name && pool.tokenName) existing.name = pool.tokenName;
            if (!existing.iconUrl && pool.tokenIconUrl) existing.iconUrl = pool.tokenIconUrl;

            tokensMap.set(pool.tokenCategory, existing);
        }

        const tokenCategories = Array.from(tokensMap.keys());

        const initialByCategory = new Map<
            string,
            {
                priceBch: number;
                createdAt: number;
            }
        >();

        const pricePointsByCategory = new Map<string, { timestamp: number; priceBch: number }[]>();

        if (tokenCategories.length > 0) {
            const last30Start = now - 30 * dayMs;

            // Volume (30d) and trade prices from swaps
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
                if (volumeBch) {
                    entry.volume30dBch += volumeBch;
                }

                const price = extractTradePrice(tx);
                if (price != null && Number.isFinite(price)) {
                    const arr =
                        pricePointsByCategory.get(tx.tokenCategory) ??
                        ([] as { timestamp: number; priceBch: number }[]);
                    arr.push({ timestamp: tx.createdAt, priceBch: price });
                    pricePointsByCategory.set(tx.tokenCategory, arr);
                }
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
                if (initialByCategory.has(tx.tokenCategory)) continue;
                const p0 = extractInitialPrice(tx);
                if (p0 == null || !Number.isFinite(p0) || p0 <= 0) continue;
                initialByCategory.set(tx.tokenCategory, {
                    priceBch: p0,
                    createdAt: tx.createdAt,
                });
            }
        }

        const last24Start = now - dayMs;
        const last7Start = now - 7 * dayMs;

        let tokens: TokenOverview[] = Array.from(tokensMap.entries())
            .map(([category, data]) => {
                const priceBch =
                    data.priceDen > 0 && Number.isFinite(data.priceNum / data.priceDen)
                        ? data.priceNum / data.priceDen
                        : null;

                const basePoints = pricePointsByCategory.get(category) ?? [];
                const initial = initialByCategory.get(category);

                const points = [...basePoints];
                if (initial) {
                    points.push({
                        timestamp: initial.createdAt,
                        priceBch: initial.priceBch,
                    });
                }
                points.sort((a, b) => a.timestamp - b.timestamp);

                let change1dPercent: number | null = null;
                let change7dPercent: number | null = null;

                if (priceBch != null && Number.isFinite(priceBch) && priceBch !== 0) {
                    const price1dBase = baselinePriceSince(points, last24Start);
                    const price7dBase = baselinePriceSince(points, last7Start);

                    const initialPrice = initial?.priceBch ?? null;
                    const changeSinceLaunch =
                        priceBch != null && initialPrice != null && initialPrice !== 0
                            ? ((priceBch - initialPrice) / Math.abs(initialPrice)) * 100
                            : null;

                    if (price1dBase != null && price1dBase !== 0) {
                        change1dPercent = ((priceBch - price1dBase) / Math.abs(price1dBase)) * 100;
                    } else {
                        change1dPercent = changeSinceLaunch;
                    }

                    if (price7dBase != null && price7dBase !== 0) {
                        change7dPercent = ((priceBch - price7dBase) / Math.abs(price7dBase)) * 100;
                    } else {
                        change7dPercent = changeSinceLaunch;
                    }
                }

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

        // Optional backend-side search: filter by symbol/name/category.
        if (q) {
            tokens = tokens.filter(t => {
                const symbol = t.symbol ?? "";
                const name = t.name ?? "";
                const category = t.tokenCategory;
                const haystack = `${symbol} ${name} ${category}`.toLowerCase();
                return haystack.includes(q);
            });
        }

        const total = tokens.length;

        // Optional pagination (e.g. for "top N" tokens or offset pages).
        if (limit != null) {
            tokens = tokens.slice(offset, offset + limit);
        } else if (offset > 0) {
            tokens = tokens.slice(offset);
        }

        const body: TokensOverviewResponse = {
            tokens,
            total,
        };

        return NextResponse.json(body);
    } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to fetch tokens overview";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
