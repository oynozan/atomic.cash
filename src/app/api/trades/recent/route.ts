import { NextRequest, NextResponse } from "next/server";

import { getTransactionsCollection, type StoredTransaction } from "@/lib/mongodb";
import { fetchTokenMetadata } from "@/dapp/common";

export const dynamic = "force-dynamic";

type TokenMeta = {
    symbol?: string;
    name?: string;
    iconUrl?: string;
};

type TradesResponse = {
    trades: StoredTransaction[];
    total: number;
    tokenMeta?: Record<string, TokenMeta>;
};

/**
 * GET /api/trades/recent?limit=...&tokenCategory=...
 *
 * Returns the most recent swap transactions (optionally for one token),
 * sorted by `createdAt` desc.
 */
export async function GET(request: NextRequest) {
    const limitParam = request.nextUrl.searchParams.get("limit");
    const limit = limitParam ? Number.parseInt(limitParam, 10) || 50 : 50;
    const tokenCategory = request.nextUrl.searchParams.get("tokenCategory") ?? undefined;

    try {
        const coll = await getTransactionsCollection();

        const filter: { type: "swap"; tokenCategory?: string } = { type: "swap" };
        if (tokenCategory) filter.tokenCategory = tokenCategory;

        const trades: StoredTransaction[] = await coll
            .find(filter)
            .sort({ createdAt: -1 })
            .limit(limit)
            .toArray();

        // Collect lightweight token metadata for all categories present
        const categories = Array.from(
            new Set(trades.map(t => t.tokenCategory).filter((c): c is string => !!c)),
        );

        const tokenMeta: Record<string, TokenMeta> = {};
        if (categories.length > 0) {
            await Promise.all(
                categories.map(async cat => {
                    const meta = await fetchTokenMetadata(cat);
                    if (meta) {
                        tokenMeta[cat] = {
                            symbol: meta.symbol,
                            name: meta.name,
                            iconUrl: meta.iconUrl,
                        };
                    }
                }),
            );
        }

        const body: TradesResponse = {
            trades,
            total: trades.length,
            tokenMeta: Object.keys(tokenMeta).length ? tokenMeta : undefined,
        };

        return NextResponse.json(body);
    } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to fetch recent trades";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
