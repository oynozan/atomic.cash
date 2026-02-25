import { NextRequest, NextResponse } from "next/server";

import { getTransactionsCollection } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

type PricePoint = { timestamp: number; priceBch: number };

type PriceHistoryResponse = {
    tokenCategory: string;
    range: string;
    points: PricePoint[];
};

function extractInitialPrice(tx: {
    amounts?: { bchIn?: number; tokenIn?: number };
}): number | null {
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

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ tokenCategory: string }> },
) {
    const { tokenCategory } = await params;
    const range = request.nextUrl.searchParams.get("range") ?? "30d";

    if (!tokenCategory) {
        return NextResponse.json({ error: "Missing tokenCategory" }, { status: 400 });
    }

    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    let start: number;
    switch (range) {
        case "24h":
        case "1d":
            start = now - dayMs;
            break;
        case "7d":
        case "1w":
            start = now - 7 * dayMs;
            break;
        case "30d":
        case "1m":
        default:
            start = now - 30 * dayMs;
            break;
    }

    try {
        const coll = await getTransactionsCollection();
        const trades = await coll
            .find({
                type: "swap",
                tokenCategory,
                createdAt: { $gte: start },
            })
            .sort({ createdAt: 1 })
            .toArray();

        const points: PricePoint[] = [];

        for (const tx of trades) {
            const a = tx.amounts as
                | {
                      bchIn?: number;
                      bchOut?: number;
                      tokenIn?: number;
                      tokenOut?: number;
                  }
                | undefined;
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
            if (tradePrice != null && Number.isFinite(tradePrice)) {
                points.push({ timestamp: tx.createdAt, priceBch: tradePrice });
            }
        }

        // Include initial pool price so that long‑term move (since launch)
        // matches the percentage change shown in headers.
        const initialTx = await coll
            .find({
                type: "create_pool",
                tokenCategory,
            })
            .sort({ createdAt: 1 })
            .limit(1)
            .toArray();

        if (initialTx.length > 0) {
            const p0 = extractInitialPrice(
                initialTx[0] as { amounts?: { bchIn?: number; tokenIn?: number } },
            );
            if (p0 != null && Number.isFinite(p0) && p0 > 0) {
                points.push({ timestamp: initialTx[0]!.createdAt, priceBch: p0 });
            }
        }

        points.sort((a, b) => a.timestamp - b.timestamp);

        const body: PriceHistoryResponse = {
            tokenCategory,
            range,
            points,
        };

        return NextResponse.json(body);
    } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to fetch price history";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
