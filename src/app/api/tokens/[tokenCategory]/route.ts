import { NextRequest, NextResponse } from "next/server";

import { getTransactionsCollection, type StoredTransaction } from "@/lib/mongodb";
import { getPoolsForToken } from "@/dapp/queries/registry";

export const dynamic = "force-dynamic";

type TokenDetailResponse = {
    tokenCategory: string;
    symbol?: string;
    name?: string;
    iconUrl?: string;
    description?: string;
    uris?: { website?: string };
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

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ tokenCategory: string }> },
) {
    const { tokenCategory } = await params;
    if (!tokenCategory) {
        return NextResponse.json({ error: "Missing tokenCategory" }, { status: 400 });
    }

    try {
        const pools = await getPoolsForToken(tokenCategory);
        if (pools.length === 0) {
            return NextResponse.json({ error: "Token not found" }, { status: 404 });
        }

        let tvlBch = 0;
        let tokenReserveTotal = 0;
        let priceNum = 0;
        let priceDen = 0;
        let symbol: string | undefined;
        let name: string | undefined;
        let iconUrl: string | undefined;

        for (const p of pools) {
            // DeFi standard: TVL includes both BCH and token side.
            // Each side worth the same in BCH → approx 2 * BCH reserve.
            tvlBch += p.bchReserve * 2;
            tokenReserveTotal += p.tokenReserve;
            priceNum += p.tokenPriceInBch * p.bchReserve;
            priceDen += p.bchReserve;
            if (!symbol && p.tokenSymbol) symbol = p.tokenSymbol;
            if (!name && p.tokenName) name = p.tokenName;
            if (!iconUrl && p.tokenIconUrl) iconUrl = p.tokenIconUrl;
        }

        const priceBch =
            priceDen > 0 && Number.isFinite(priceNum / priceDen) ? priceNum / priceDen : null;

        const txColl = await getTransactionsCollection();
        const now = Date.now();
        const dayMs = 24 * 60 * 60 * 1000;
        const last24Start = now - dayMs;
        const prev24Start = now - 2 * dayMs;
        const last30Start = now - 30 * dayMs;
        const prev30Start = now - 60 * dayMs;

        const recentSwaps = await txColl
            .find({
                type: "swap",
                tokenCategory,
                createdAt: { $gte: prev30Start },
            })
            .toArray();

        let volume24hBch = 0;
        let prev24hBch = 0;
        let volume30dBch = 0;
        let prev30dBch = 0;

        const pricePoints: { timestamp: number; priceBch: number }[] = [];

        for (const tx of recentSwaps) {
            const volumeBch = extractBchVolume(tx);
            if (volumeBch) {
                if (tx.createdAt >= last24Start) volume24hBch += volumeBch;
                else if (tx.createdAt >= prev24Start) prev24hBch += volumeBch;

                if (tx.createdAt >= last30Start) volume30dBch += volumeBch;
                else if (tx.createdAt >= prev30Start) prev30dBch += volumeBch;
            }

            const tradePrice = extractTradePrice(tx);
            if (tradePrice != null && Number.isFinite(tradePrice)) {
                pricePoints.push({ timestamp: tx.createdAt, priceBch: tradePrice });
            }
        }

        // Initial price from earliest create_pool for this token (same as tokens overview)
        const initialTx = await txColl
            .find({
                type: "create_pool",
                tokenCategory,
            })
            .sort({ createdAt: 1 })
            .limit(1)
            .toArray();

        let initialPrice: number | null = null;
        if (initialTx.length > 0) {
            const p0 = extractInitialPrice(initialTx[0]!);
            if (p0 != null && Number.isFinite(p0) && p0 > 0) {
                initialPrice = p0;
                pricePoints.push({
                    timestamp: initialTx[0]!.createdAt,
                    priceBch: p0,
                });
            }
        }

        pricePoints.sort((a, b) => a.timestamp - b.timestamp);

        const changeSinceLaunch =
            priceBch != null && initialPrice != null && initialPrice !== 0
                ? ((priceBch - initialPrice) / Math.abs(initialPrice)) * 100
                : null;

        let change1dPercent: number | null = null;
        let change7dPercent: number | null = null;

        if (priceBch != null && Number.isFinite(priceBch) && priceBch !== 0) {
            const price1dBase = baselinePriceSince(pricePoints, last24Start);
            const price7dBase = baselinePriceSince(pricePoints, now - 7 * dayMs);

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

        const body: TokenDetailResponse = {
            tokenCategory,
            symbol,
            name,
            iconUrl,
            priceBch,
            tvlBch,
            tokenReserveTotal,
            volume24hBch,
            volume30dBch,
            prev24hBch,
            prev30dBch,
            change1dPercent,
            change7dPercent,
        };

        return NextResponse.json(body);
    } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to fetch token";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
