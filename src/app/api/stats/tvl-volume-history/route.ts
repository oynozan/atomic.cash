import { NextRequest, NextResponse } from "next/server";

import { getTransactionsCollection, type StoredTransaction } from "@/lib/mongodb";
import { getAllPools } from "@/dapp/queries/registry";

export const dynamic = "force-dynamic";

type HistoryPoint = { timestamp: number; tvlBch: number; volumeBch: number };

type TvlVolumeHistoryResponse = {
    range: string;
    points: HistoryPoint[];
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

function liquidityDelta(tx: StoredTransaction): number {
    const a = tx.amounts;
    if (!a) return 0;
    if (tx.type === "create_pool" || tx.type === "add_liquidity") {
        const b = a.bchIn;
        return typeof b === "number" && Number.isFinite(b) && b > 0 ? b : 0;
    }
    if (tx.type === "remove_liquidity") {
        const b = a.bchOut;
        return typeof b === "number" && Number.isFinite(b) && b > 0 ? -b : 0;
    }
    return 0;
}

/**
 * GET /api/stats/tvl-volume-history?range=7d|30d|90d
 *
 * Returns time-series points for TVL and Volume (platform-wide) in BCH.
 * Buckets are daily; each point is end-of-day timestamp with that day's volume and TVL at that time.
 */
export async function GET(request: NextRequest) {
    const range = request.nextUrl.searchParams.get("range") ?? "30d";
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    let start: number;
    switch (range) {
        case "7d":
            start = now - 7 * dayMs;
            break;
        case "30d":
            start = now - 30 * dayMs;
            break;
        case "90d":
            start = now - 90 * dayMs;
            break;
        default:
            start = now - 30 * dayMs;
            break;
    }

    try {
        const [allPools, coll] = await Promise.all([getAllPools(), getTransactionsCollection()]);

        const currentTvlBch = allPools.pools.reduce((sum, pool) => sum + pool.bchReserve * 2, 0);

        const [swaps, liquidityTxs] = await Promise.all([
            coll.find({ type: "swap", createdAt: { $gte: start } }).sort({ createdAt: 1 }).toArray(),
            coll
                .find({
                    type: { $in: ["create_pool", "add_liquidity", "remove_liquidity"] },
                    createdAt: { $gte: start },
                })
                .sort({ createdAt: 1 })
                .toArray(),
        ]);

        const numDays = Math.max(1, Math.ceil((now - start) / dayMs));
        const points: HistoryPoint[] = [];

        for (let i = 0; i < numDays; i++) {
            const bucketEnd = start + (i + 1) * dayMs;
            const bucketStart = start + i * dayMs;
            const t = Math.min(bucketEnd, now);

            let volumeBch = 0;
            for (const tx of swaps) {
                if (tx.createdAt >= bucketStart && tx.createdAt < bucketEnd) {
                    volumeBch += extractBchVolume(tx);
                }
            }

            let netChangeAfterT = 0;
            for (const tx of liquidityTxs) {
                if (tx.createdAt > t) {
                    netChangeAfterT += liquidityDelta(tx);
                }
            }
            const tvlBch = Math.max(0, currentTvlBch - netChangeAfterT);

            points.push({
                timestamp: Math.floor(t / 1000) * 1000,
                tvlBch,
                volumeBch,
            });
        }

        const body: TvlVolumeHistoryResponse = { range, points };
        return NextResponse.json(body);
    } catch (err) {
        const message =
            err instanceof Error ? err.message : "Failed to fetch TVL/Volume history";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
