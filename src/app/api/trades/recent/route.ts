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
    hasMore?: boolean;
    nextCursor?: number;
    tokenMeta?: Record<string, TokenMeta>;
};

/**
 * GET /api/trades/recent?limit=...&tokenCategory=...&cursor=...
 *
 * Returns the most recent swap transactions (optionally for one token),
 * sorted by `createdAt` desc. cursor = createdAt (ms) for pagination.
 */
export async function GET(request: NextRequest) {
    const limitParam = request.nextUrl.searchParams.get("limit");
    const cursorParam = request.nextUrl.searchParams.get("cursor");
    const limit = Math.min(
        Math.max(limitParam ? Number.parseInt(limitParam, 10) || 20 : 20, 1),
        100,
    );
    const cursor = cursorParam ? Number.parseInt(cursorParam, 10) : undefined;
    const tokenCategory = request.nextUrl.searchParams.get("tokenCategory") ?? undefined;

    try {
        const coll = await getTransactionsCollection();

        const filter: { type: "swap"; tokenCategory?: string; createdAt?: { $lt: number } } = {
            type: "swap",
        };
        if (tokenCategory) filter.tokenCategory = tokenCategory;
        if (cursor != null && !Number.isNaN(cursor)) filter.createdAt = { $lt: cursor };

        const [total, raw] = await Promise.all([
            coll.countDocuments(
                tokenCategory ? { type: "swap", tokenCategory } : { type: "swap" },
            ),
            coll
                .find(filter)
                .sort({ createdAt: -1 })
                .limit(limit + 1)
                .toArray(),
        ]);

        const hasMore = raw.length > limit;
        const trades = hasMore ? raw.slice(0, limit) : raw;
        const nextCursor = hasMore && trades.length > 0 ? trades[trades.length - 1].createdAt : undefined;

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
            total,
            ...(hasMore && nextCursor != null ? { hasMore: true, nextCursor } : {}),
            tokenMeta: Object.keys(tokenMeta).length ? tokenMeta : undefined,
        };

        return NextResponse.json(body);
    } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to fetch recent trades";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
