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
            tvlBch += p.bchReserve;
            tokenReserveTotal += p.tokenReserve;
            priceNum += p.tokenPriceInBch * p.bchReserve;
            priceDen += p.bchReserve;
            if (!symbol && p.tokenSymbol) symbol = p.tokenSymbol;
            if (!name && p.tokenName) name = p.tokenName;
            if (!iconUrl && p.tokenIconUrl) iconUrl = p.tokenIconUrl;
        }

        const priceBch =
            priceDen > 0 && Number.isFinite(priceNum / priceDen) ? priceNum / priceDen : null;

        const now = Date.now();
        const dayMs = 24 * 60 * 60 * 1000;
        const last1dStart = now - dayMs;
        const last7dStart = now - 7 * dayMs;
        const last24Start = now - dayMs;
        const prev24Start = now - 2 * dayMs;
        const last30Start = now - 30 * dayMs;
        const prev30Start = now - 60 * dayMs;

        const txColl = await getTransactionsCollection();
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
        let price1dNum = 0;
        let price1dDen = 0;
        let price7dNum = 0;
        let price7dDen = 0;

        for (const tx of recentSwaps) {
            const volumeBch = extractBchVolume(tx);
            if (!volumeBch) continue;

            if (tx.createdAt >= last24Start) volume24hBch += volumeBch;
            else if (tx.createdAt >= prev24Start) prev24hBch += volumeBch;

            if (tx.createdAt >= last30Start) volume30dBch += volumeBch;
            else if (tx.createdAt >= prev30Start) prev30dBch += volumeBch;

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

            if (tx.createdAt >= last7dStart) {
                price7dNum += tradePrice * volumeBch;
                price7dDen += volumeBch;
            }
            if (tx.createdAt >= last1dStart) {
                price1dNum += tradePrice * volumeBch;
                price1dDen += volumeBch;
            }
        }

        const avg1d =
            price1dDen > 0 && Number.isFinite(price1dNum / price1dDen)
                ? price1dNum / price1dDen
                : null;
        const avg7d =
            price7dDen > 0 && Number.isFinite(price7dNum / price7dDen)
                ? price7dNum / price7dDen
                : null;

        const change1dPercent =
            priceBch != null && avg1d != null && avg1d !== 0
                ? ((priceBch - avg1d) / Math.abs(avg1d)) * 100
                : null;
        const change7dPercent =
            priceBch != null && avg7d != null && avg7d !== 0
                ? ((priceBch - avg7d) / Math.abs(avg7d)) * 100
                : null;

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
