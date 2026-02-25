import { NextRequest, NextResponse } from "next/server";
import { getTransactionsCollection, type StoredTransaction } from "@/lib/mongodb";
import { fetchTokenMetadata } from "@/dapp/common";

export const dynamic = "force-dynamic";

/**
 * GET /api/portfolio/history?address=...&limit=...
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
    const address = request.nextUrl.searchParams.get("address");

    if (!address || address.trim() === "") {
        return NextResponse.json({ error: "Missing or empty address" }, { status: 400 });
    }

    const limitParam = request.nextUrl.searchParams.get("limit");

    const limit = limitParam ? Number.parseInt(limitParam, 10) || 10 : 10;

    const trimmedAddress = address.trim();

    try {
        // 1) Dapp transactions from Mongo (sorted by createdAt desc)
        const coll = await getTransactionsCollection();

        const dappDocs: StoredTransaction[] = await coll
            .find({ address: trimmedAddress })
            .sort({ createdAt: -1 })
            .limit(limit)
            .toArray();

        // Collect lightweight token metadata for all categories present
        const categories = Array.from(
            new Set(dappDocs.map(tx => tx.tokenCategory).filter((c): c is string => !!c)),
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
                transactions: dappDocs,
                total: dappDocs.length,
                hasMore: false,
            },
            tokenMeta: Object.keys(tokenMeta).length ? tokenMeta : undefined,
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to fetch activity history";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
