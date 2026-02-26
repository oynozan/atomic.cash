import { NextRequest, NextResponse } from "next/server";

import { fetchTokenMetadata } from "@/dapp/common";
import { getAuthFromRequest } from "@/lib/auth";
import { getTransactionsCollection, type StoredTransaction } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

/**
 * GET /api/portfolio/history?limit=...&cursor=...
 *
 * Returns:
 * - `dapp`  → High-level dapp transactions (swap, pool create, add/remove liquidity)
 * - `tokenMeta` → Lightweight token metadata for any tokens involved
 *
 * The client decides how many to show (e.g. last 5 on overview).
 */
type TokenMeta = {
    symbol?: string;
    name?: string;
    iconUrl?: string;
};

export async function GET(request: NextRequest) {
    const auth = getAuthFromRequest(request);
    if (!auth) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limitParam = request.nextUrl.searchParams.get("limit");
    const cursorParam = request.nextUrl.searchParams.get("cursor");

    const limit = Math.min(
        Math.max(limitParam ? Number.parseInt(limitParam, 10) || 20 : 20, 1),
        100,
    );
    const cursor = cursorParam ? Number.parseInt(cursorParam, 10) : undefined;

    try {
        const coll = await getTransactionsCollection();

        const filter: { address: string; createdAt?: { $lt: number } } = {
            address: auth.address.trim(),
        };
        if (cursor != null && !Number.isNaN(cursor)) {
            filter.createdAt = { $lt: cursor };
        }

        const dappDocs: StoredTransaction[] = await coll
            .find(filter)
            .sort({ createdAt: -1 })
            .limit(limit + 1)
            .toArray();

        const hasMore = dappDocs.length > limit;
        const page = hasMore ? dappDocs.slice(0, limit) : dappDocs;
        const nextCursor = page.length > 0 ? page[page.length - 1].createdAt : undefined;

        const categories = Array.from(
            new Set(page.map(tx => tx.tokenCategory).filter((c): c is string => !!c)),
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

        return NextResponse.json({
            dapp: {
                transactions: page,
                total: page.length,
                hasMore,
                nextCursor: hasMore ? nextCursor : undefined,
            },
            tokenMeta: Object.keys(tokenMeta).length ? tokenMeta : undefined,
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to fetch activity history";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
